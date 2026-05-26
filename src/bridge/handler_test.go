package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// モック FFmpegRunner / FFmpegProcess
type mockFFmpegProcess struct {
	*bytes.Buffer
	stopped bool
	doneCh  chan struct{}
}

func newMockFFmpegProcess() *mockFFmpegProcess {
	return &mockFFmpegProcess{Buffer: &bytes.Buffer{}, doneCh: make(chan struct{})}
}

func (m *mockFFmpegProcess) Close() error { return nil }
func (m *mockFFmpegProcess) Stop()        { m.stopped = true }
func (m *mockFFmpegProcess) Done() <-chan struct{} { return m.doneCh }

// SimulateCrash は FFmpeg プロセスのクラッシュをシミュレートする。
func (m *mockFFmpegProcess) SimulateCrash() {
	select {
	case <-m.doneCh:
	default:
		close(m.doneCh)
	}
}

type mockFFmpegRunner struct {
	buf        *bytes.Buffer
	proc       *mockFFmpegProcess
	startCount int
	lastParams FFmpegParams
	startErr   error
	nextProcs  []*mockFFmpegProcess
}

func newMockFFmpegRunner() *mockFFmpegRunner {
	proc := newMockFFmpegProcess()
	return &mockFFmpegRunner{buf: proc.Buffer, proc: proc}
}

func (m *mockFFmpegRunner) Start(params FFmpegParams) (FFmpegProcess, error) {
	m.startCount++
	m.lastParams = params
	if m.startErr != nil {
		return nil, m.startErr
	}
	if m.startCount == 1 {
		return m.proc, nil
	}
	idx := m.startCount - 2
	if idx < len(m.nextProcs) {
		return m.nextProcs[idx], nil
	}
	return newMockFFmpegProcess(), nil
}

func newTestRouter(store *SessionStore, runner FFmpegRunner) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := &Handler{
		store:  store,
		runner: runner,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool { return true },
		},
	}
	r.POST("/bridge/sessions", h.RegisterSession)
	r.DELETE("/bridge/sessions/:id", h.StopSession)
	r.POST("/bridge/sessions/:id/stats", h.PushStats)
	r.GET("/ws", h.HandleWebSocket)
	return r
}

func dialTestWS(t *testing.T, ts *httptest.Server, sessionID string) *websocket.Conn {
	t.Helper()
	wsURL := "ws" + strings.TrimPrefix(ts.URL, "http") + "/ws?session_id=" + sessionID
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("WebSocket dial failed: %v", err)
	}
	return conn
}

func TestRegisterSession(t *testing.T) {
	store := NewSessionStore()
	runner := newMockFFmpegRunner()
	r := newTestRouter(store, runner)

	t.Run("正常登録 201", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{
			"session_id": "test-sess-1",
			"rtmp_url":   "rtmp://a.rtmp.youtube.com/live2/key-abc",
		})
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
		}
		sess, err := store.Get("test-sess-1")
		if err != nil {
			t.Fatalf("session not stored: %v", err)
		}
		if sess.RTMPURL != "rtmp://a.rtmp.youtube.com/live2/key-abc" {
			t.Fatalf("unexpected rtmp_url: %s", sess.RTMPURL)
		}
	})

	t.Run("不正なボディ 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions", bytes.NewReader([]byte("invalid")))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("session_id 欠落 400", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"rtmp_url": "rtmp://example.com"})
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("rtmp_url 欠落 400", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{"session_id": "sess-x"})
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("重複登録 409", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{
			"session_id": "test-sess-1",
			"rtmp_url":   "rtmp://b.rtmp.youtube.com/live2/key-dup",
		})
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Fatalf("expected 409, got %d", w.Code)
		}
	})

	t.Run("非 YouTube ホスト 400（SSRF/任意ファイル書き込み防止）", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{
			"session_id": "attack-sess",
			"rtmp_url":   "rtmp://attacker.example.com/leak",
		})
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("file スキーム 400（任意ファイル書き込み防止）", func(t *testing.T) {
		body, _ := json.Marshal(map[string]string{
			"session_id": "attack-sess-2",
			"rtmp_url":   "file:///etc/cron.d/pwn",
		})
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})
}

func TestPushStats(t *testing.T) {
	t.Run("存在しないセッション 404", func(t *testing.T) {
		store := NewSessionStore()
		runner := newMockFFmpegRunner()
		r := newTestRouter(store, runner)

		body, _ := json.Marshal(map[string]interface{}{"bitrate_kbps": 2500})
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions/unknown/stats", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", w.Code)
		}
	})

	t.Run("WebSocket未接続でもサイレントスキップして200", func(t *testing.T) {
		store := NewSessionStore()
		runner := newMockFFmpegRunner()
		r := newTestRouter(store, runner)

		store.Register("sess-no-ws", "rtmp://a.rtmp.youtube.com/live2/key")

		body, _ := json.Marshal(map[string]interface{}{"bitrate_kbps": 2500})
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions/sess-no-ws/stats", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("WebSocket接続中にwriteChanへ転送して200", func(t *testing.T) {
		store := NewSessionStore()
		runner := newMockFFmpegRunner()
		r := newTestRouter(store, runner)

		store.Register("sess-with-ws", "rtmp://a.rtmp.youtube.com/live2/key")
		sess, _ := store.Get("sess-with-ws")
		ch := make(chan []byte, 4)
		sess.SetWriteChan(ch)

		payload := map[string]interface{}{"bitrate_kbps": 3000, "viewer_count": 42}
		body, _ := json.Marshal(payload)
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions/sess-with-ws/stats", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		select {
		case received := <-ch:
			var got map[string]interface{}
			if err := json.Unmarshal(received, &got); err != nil {
				t.Fatalf("invalid JSON in writeChan: %v", err)
			}
			if got["bitrate_kbps"] != float64(3000) {
				t.Errorf("expected bitrate_kbps=3000, got %v", got["bitrate_kbps"])
			}
		default:
			t.Fatal("writeChan should have received stats data")
		}
	})

	t.Run("不正なJSONボディ 400", func(t *testing.T) {
		store := NewSessionStore()
		runner := newMockFFmpegRunner()
		r := newTestRouter(store, runner)

		store.Register("sess-bad-json", "rtmp://a.rtmp.youtube.com/live2/key")

		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions/sess-bad-json/stats", bytes.NewReader([]byte("not-json")))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})
}

func TestStopSession(t *testing.T) {
	t.Run("登録済みセッションを停止 200", func(t *testing.T) {
		store := NewSessionStore()
		runner := newMockFFmpegRunner()
		r := newTestRouter(store, runner)

		store.Register("sess-stop", "rtmp://a.rtmp.youtube.com/live2/key")

		req := httptest.NewRequest(http.MethodDelete, "/bridge/sessions/sess-stop", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
		}

		// セッションがストアから削除されていること
		_, err := store.Get("sess-stop")
		if !errors.Is(err, ErrSessionNotFound) {
			t.Fatalf("session should be deleted after stop")
		}
	})

	t.Run("存在しないセッション 404", func(t *testing.T) {
		store := NewSessionStore()
		runner := newMockFFmpegRunner()
		r := newTestRouter(store, runner)

		req := httptest.NewRequest(http.MethodDelete, "/bridge/sessions/nonexistent", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", w.Code)
		}
	})

	t.Run("stop で stopFunc が呼ばれる", func(t *testing.T) {
		store := NewSessionStore()
		store.Register("sess-with-stop", "rtmp://a.rtmp.youtube.com/live2/key")
		sess, _ := store.Get("sess-with-stop")

		called := false
		sess.SetStopFunc(func() { called = true })

		sess.Stop()

		if !called {
			t.Fatal("stopFunc should have been called")
		}
	})
}

func TestMockFFmpegProcess_Done(t *testing.T) {
	t.Run("初期状態ではdoneチャネルはオープン", func(t *testing.T) {
		proc := newMockFFmpegProcess()
		select {
		case <-proc.Done():
			t.Error("done channel should be open initially")
		default:
		}
	})

	t.Run("SimulateCrash後はdoneチャネルがクローズ", func(t *testing.T) {
		proc := newMockFFmpegProcess()
		proc.SimulateCrash()
		select {
		case <-proc.Done():
		default:
			t.Error("done channel should be closed after SimulateCrash")
		}
	})

	t.Run("SimulateCrashは複数回呼んでもパニックしない", func(t *testing.T) {
		proc := newMockFFmpegProcess()
		proc.SimulateCrash()
		proc.SimulateCrash() // 2回目はno-op
	})
}

func TestHandleWebSocket_FFmpegCrash_AutoRestart(t *testing.T) {
	store := NewSessionStore()
	proc1 := newMockFFmpegProcess()
	proc2 := newMockFFmpegProcess()
	runner := &mockFFmpegRunner{
		buf:       proc1.Buffer,
		proc:      proc1,
		nextProcs: []*mockFFmpegProcess{proc2},
	}

	ts := httptest.NewServer(newTestRouter(store, runner))
	defer ts.Close()

	store.Register("sess-crash", "rtmp://a.rtmp.youtube.com/live2/key")

	conn := dialTestWS(t, ts, "sess-crash")
	defer conn.Close()

	// 最初のフレームを送る
	if err := conn.WriteMessage(websocket.BinaryMessage, []byte("frame1")); err != nil {
		t.Fatalf("WriteMessage: %v", err)
	}
	time.Sleep(20 * time.Millisecond)

	// FFmpegクラッシュをシミュレート
	proc1.SimulateCrash()

	// 次のフレームでクラッシュ検知 → 自動再起動
	if err := conn.WriteMessage(websocket.BinaryMessage, []byte("frame2")); err != nil {
		t.Fatalf("WriteMessage after crash: %v", err)
	}
	time.Sleep(50 * time.Millisecond)

	if runner.startCount != 2 {
		t.Errorf("expected startCount=2 (initial + restart), got %d", runner.startCount)
	}
	if !proc1.stopped {
		t.Error("proc1 should be stopped after crash restart")
	}
}

func TestHandleWebSocket_FFmpegCrash_MaxRestartsExceeded(t *testing.T) {
	store := NewSessionStore()
	proc0 := newMockFFmpegProcess()
	nextProcs := make([]*mockFFmpegProcess, maxFFmpegRestarts)
	for i := range nextProcs {
		nextProcs[i] = newMockFFmpegProcess()
	}
	runner := &mockFFmpegRunner{
		buf:       proc0.Buffer,
		proc:      proc0,
		nextProcs: nextProcs,
	}

	ts := httptest.NewServer(newTestRouter(store, runner))
	defer ts.Close()

	store.Register("sess-maxcrash", "rtmp://a.rtmp.youtube.com/live2/key")

	conn := dialTestWS(t, ts, "sess-maxcrash")

	// エラーメッセージ受信チャネル
	errReceived := make(chan string, 1)
	go func() {
		for {
			_, msg, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var payload map[string]string
			if json.Unmarshal(msg, &payload) == nil {
				if code, ok := payload["error"]; ok {
					errReceived <- code
					return
				}
			}
		}
	}()

	// 全プロセスをクラッシュさせる
	allProcs := append([]*mockFFmpegProcess{proc0}, nextProcs...)
	for _, p := range allProcs {
		p.SimulateCrash()
		conn.WriteMessage(websocket.BinaryMessage, []byte("frame"))
		time.Sleep(20 * time.Millisecond)
	}

	select {
	case errCode := <-errReceived:
		if errCode != "ffmpeg_max_restarts_exceeded" {
			t.Errorf("expected ffmpeg_max_restarts_exceeded, got %s", errCode)
		}
	case <-time.After(500 * time.Millisecond):
		t.Error("expected error message within 500ms")
	}
}

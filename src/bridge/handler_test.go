package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// モック FFmpegRunner / FFmpegProcess
type mockFFmpegProcess struct {
	*bytes.Buffer
	stopped bool
}

func (m *mockFFmpegProcess) Close() error { return nil }
func (m *mockFFmpegProcess) Stop()        { m.stopped = true }

type mockFFmpegRunner struct {
	buf  *bytes.Buffer
	proc *mockFFmpegProcess
}

func newMockFFmpegRunner() *mockFFmpegRunner {
	buf := &bytes.Buffer{}
	return &mockFFmpegRunner{buf: buf, proc: &mockFFmpegProcess{Buffer: buf}}
}

func (m *mockFFmpegRunner) Start(rtmpURL string) (FFmpegProcess, error) {
	return m.proc, nil
}

func newTestRouter(store *SessionStore, runner FFmpegRunner) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := &Handler{store: store, runner: runner}
	r.POST("/bridge/sessions", h.RegisterSession)
	r.DELETE("/bridge/sessions/:id", h.StopSession)
	r.GET("/ws", h.HandleWebSocket)
	return r
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

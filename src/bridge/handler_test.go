package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// モック FFmpegRunner
type mockFFmpegRunner struct {
	buf *bytes.Buffer
}

type nopWriteCloser struct{ *bytes.Buffer }

func (nopWriteCloser) Close() error { return nil }

func newMockFFmpegRunner() *mockFFmpegRunner {
	return &mockFFmpegRunner{buf: &bytes.Buffer{}}
}

func (m *mockFFmpegRunner) Start(rtmpURL string) (io.WriteCloser, error) {
	return nopWriteCloser{m.buf}, nil
}

func newTestRouter(store *SessionStore, runner FFmpegRunner) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	h := &Handler{store: store, runner: runner}
	r.POST("/bridge/sessions", h.RegisterSession)
	r.GET("/ws", h.HandleWebSocket)
	return r
}

func TestRegisterSession(t *testing.T) {
	store := NewSessionStore()
	runner := newMockFFmpegRunner()
	r := newTestRouter(store, runner)

	t.Run("正常登録 200", func(t *testing.T) {
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
			"rtmp_url":   "rtmp://example.com/dup",
		})
		req := httptest.NewRequest(http.MethodPost, "/bridge/sessions", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusConflict {
			t.Fatalf("expected 409, got %d", w.Code)
		}
	})
}

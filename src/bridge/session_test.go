package main

import (
	"testing"
)

func TestSessionStore_Register(t *testing.T) {
	store := NewSessionStore()

	t.Run("正常登録", func(t *testing.T) {
		err := store.Register("sess1", "rtmp://example.com/live/key1")
		if err != nil {
			t.Fatalf("Register failed: %v", err)
		}
	})

	t.Run("重複登録は ErrSessionExists", func(t *testing.T) {
		err := store.Register("sess1", "rtmp://example.com/live/key2")
		if err != ErrSessionExists {
			t.Fatalf("expected ErrSessionExists, got %v", err)
		}
	})
}

func TestSessionStore_Get(t *testing.T) {
	store := NewSessionStore()
	store.Register("sess2", "rtmp://example.com/live/key2")

	t.Run("登録済みセッション取得", func(t *testing.T) {
		sess, err := store.Get("sess2")
		if err != nil {
			t.Fatalf("Get failed: %v", err)
		}
		if sess.RTMPURL != "rtmp://example.com/live/key2" {
			t.Fatalf("unexpected rtmp_url: %s", sess.RTMPURL)
		}
	})

	t.Run("未登録は ErrSessionNotFound", func(t *testing.T) {
		_, err := store.Get("unknown")
		if err != ErrSessionNotFound {
			t.Fatalf("expected ErrSessionNotFound, got %v", err)
		}
	})
}

func TestSessionStore_Delete(t *testing.T) {
	store := NewSessionStore()
	store.Register("sess3", "rtmp://example.com/live/key3")
	store.Delete("sess3")

	_, err := store.Get("sess3")
	if err != ErrSessionNotFound {
		t.Fatalf("expected session to be deleted, got %v", err)
	}
}

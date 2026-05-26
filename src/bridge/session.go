package main

import (
	"errors"
	"sync"
	"time"
)

var ErrSessionNotFound = errors.New("session not found")
var ErrSessionExists = errors.New("session already exists")

type Session struct {
	ID        string
	RTMPURL   string
	mu        sync.Mutex
	stopFunc  func()
	writeChan chan []byte
	adapter   *QualityAdapter
	restartCh chan QualityParams
}

func (s *Session) SetStopFunc(f func()) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stopFunc = f
}

func (s *Session) Stop() {
	s.mu.Lock()
	f := s.stopFunc
	s.mu.Unlock()
	if f != nil {
		f()
	}
}

func (s *Session) SetWriteChan(ch chan []byte) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.writeChan = ch
}

// Adapt は品質アダプターに新しい統計を渡し、調整結果を返す。
func (s *Session) Adapt(fps float64, droppedFrames, bufferSizeKB int, now time.Time) AdaptResult {
	return s.adapter.Adapt(fps, droppedFrames, bufferSizeKB, now)
}

// CurrentBitrate は現在のビットレート設定を返す。
func (s *Session) CurrentBitrate() int {
	return s.adapter.CurrentBitrate()
}

// SendRestart はFFmpeg再起動シグナルを送信する（チャネル満杯時はドロップ）。
func (s *Session) SendRestart(params QualityParams) bool {
	select {
	case s.restartCh <- params:
		return true
	default:
		return false
	}
}

// RecvRestart はFFmpeg再起動シグナルを非ブロッキングで受信する。
func (s *Session) RecvRestart() (QualityParams, bool) {
	select {
	case params := <-s.restartCh:
		return params, true
	default:
		return QualityParams{}, false
	}
}

func (s *Session) TrySendStats(data []byte) bool {
	s.mu.Lock()
	ch := s.writeChan
	s.mu.Unlock()
	if ch == nil {
		return false
	}
	select {
	case ch <- data:
		return true
	default:
		return false
	}
}

type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*Session
}

func NewSessionStore() *SessionStore {
	return &SessionStore{sessions: make(map[string]*Session)}
}

func (s *SessionStore) Register(id, rtmpURL string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.sessions[id]; ok {
		return ErrSessionExists
	}
	s.sessions[id] = &Session{
		ID:        id,
		RTMPURL:   rtmpURL,
		adapter:   NewQualityAdapter(defaultBitrateKbps, defaultResolution),
		restartCh: make(chan QualityParams, 1),
	}
	return nil
}

func (s *SessionStore) Get(id string) (*Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sess, ok := s.sessions[id]
	if !ok {
		return nil, ErrSessionNotFound
	}
	return sess, nil
}

func (s *SessionStore) Delete(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, id)
}

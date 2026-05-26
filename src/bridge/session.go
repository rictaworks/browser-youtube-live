package main

import (
	"errors"
	"sync"
)

var ErrSessionNotFound = errors.New("session not found")
var ErrSessionExists = errors.New("session already exists")

type Session struct {
	ID      string
	RTMPURL string
	mu       sync.Mutex
	stopFunc func()
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
	s.sessions[id] = &Session{ID: id, RTMPURL: rtmpURL}
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

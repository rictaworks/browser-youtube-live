package main

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type Handler struct {
	store    *SessionStore
	runner   FFmpegRunner
	upgrader websocket.Upgrader
}

type registerRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	RTMPURL   string `json:"rtmp_url"   binding:"required"`
}

func (h *Handler) RegisterSession(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.store.Register(req.SessionID, req.RTMPURL); err != nil {
		if errors.Is(err, ErrSessionExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "session already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"session_id": req.SessionID})
}

func (h *Handler) HandleWebSocket(c *gin.Context) {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "session_id is required"})
		return
	}

	sess, err := h.store.Get(sessionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	stdin, err := h.runner.Start(sess.RTMPURL)
	if err != nil {
		log.Printf("FFmpeg start error: %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte(`{"error":"ffmpeg start failed"}`))
		return
	}
	defer stdin.Close()
	defer h.store.Delete(sessionID)

	log.Printf("WebSocket connected for session %s → %s", sessionID, sess.RTMPURL)

	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error (session %s): %v", sessionID, err)
			break
		}
		if msgType == websocket.BinaryMessage {
			if _, err := stdin.Write(data); err != nil {
				log.Printf("FFmpeg write error (session %s): %v", sessionID, err)
				break
			}
		}
	}
}

package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

const maxFFmpegRestarts = 3

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

	if err := ValidateRTMPURL(req.RTMPURL); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid rtmp_url"})
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

func (h *Handler) StopSession(c *gin.Context) {
	id := c.Param("id")
	sess, err := h.store.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	sess.Stop()
	h.store.Delete(id)

	c.JSON(http.StatusOK, gin.H{"session_id": id})
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

	var proc FFmpegProcess
	proc, err = h.runner.Start(FFmpegParams{RTMPURL: sess.RTMPURL, BitrateKbps: sess.CurrentBitrate()})
	if err != nil {
		log.Printf("FFmpeg start error: %v", err)
		conn.WriteMessage(websocket.TextMessage, []byte(`{"error":"ffmpeg start failed"}`))
		return
	}
	defer func() { proc.Stop() }()
	defer h.store.Delete(sessionID)

	writeCh := make(chan []byte, 32)
	sess.SetWriteChan(writeCh)
	defer func() {
		sess.SetWriteChan(nil)
		close(writeCh)
	}()

	go func() {
		for data := range writeCh {
			if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
				log.Printf("WebSocket stats write error (session %s): %v", sessionID, err)
			}
		}
	}()

	sess.SetStopFunc(func() {
		conn.WriteMessage(
			websocket.CloseMessage,
			websocket.FormatCloseMessage(websocket.CloseNormalClosure, "配信停止"),
		)
		conn.Close()
		proc.Stop()
	})

	log.Printf("WebSocket connected for session %s → %s", sessionID, sess.RTMPURL)

	crashRestarts := 0

	for {
		msgType, data, err := conn.ReadMessage()
		if err != nil {
			log.Printf("WebSocket read error (session %s): %v", sessionID, err)
			break
		}
		if msgType == websocket.BinaryMessage {
			// 品質変更シグナルがあればFFmpegを再起動する（非ブロッキング）
			if params, ok := sess.RecvRestart(); ok {
				newProc, restartErr := h.runner.Start(FFmpegParams{RTMPURL: sess.RTMPURL, BitrateKbps: params.BitrateKbps})
				if restartErr == nil {
					proc.Stop()
					proc = newProc
					crashRestarts = 0 // 品質変更再起動でクラッシュカウンタをリセット
					log.Printf("[adaptive] session %s FFmpeg restarted: bitrate=%dkbps resolution=%s",
						sessionID, params.BitrateKbps, params.Resolution)
				} else {
					log.Printf("[adaptive] FFmpeg restart error (session %s): %v", sessionID, restartErr)
				}
			}

			// FFmpegクラッシュ検知（doneチャネルがクローズ済みかチェック）
			select {
			case <-proc.Done():
				if crashRestarts >= maxFFmpegRestarts {
					log.Printf("[recover] session %s FFmpeg max restarts (%d) exceeded", sessionID, maxFFmpegRestarts)
					conn.WriteMessage(websocket.TextMessage, []byte(`{"error":"ffmpeg_max_restarts_exceeded"}`))
					return
				}
				newProc, restartErr := h.runner.Start(FFmpegParams{RTMPURL: sess.RTMPURL, BitrateKbps: sess.CurrentBitrate()})
				if restartErr != nil {
					log.Printf("[recover] session %s FFmpeg restart failed: %v", sessionID, restartErr)
					conn.WriteMessage(websocket.TextMessage, []byte(`{"error":"ffmpeg_restart_failed"}`))
					return
				}
				proc.Stop()
				proc = newProc
				crashRestarts++
				log.Printf("[recover] session %s FFmpeg auto-restarted (attempt %d/%d)", sessionID, crashRestarts, maxFFmpegRestarts)
			default:
			}

			if _, err := proc.Write(data); err != nil {
				log.Printf("FFmpeg write error (session %s): %v", sessionID, err)
				break
			}
		}
	}
}

func (h *Handler) PushStats(c *gin.Context) {
	id := c.Param("id")
	sess, err := h.store.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	body, err := io.ReadAll(c.Request.Body)
	if err != nil || len(body) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}
	if !json.Valid(body) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "body must be valid JSON"})
		return
	}

	h.adaptQuality(sess, body)

	sess.TrySendStats(body)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// adaptQuality は統計ボディを解析し、品質自動調整を実行する。
func (h *Handler) adaptQuality(sess *Session, body []byte) {
	var statsPayload struct {
		FPS          float64 `json:"fps"`
		DroppedFrames int    `json:"dropped_frames"`
		BufferSizeKB  int    `json:"buffer_size_kb"`
	}
	if err := json.Unmarshal(body, &statsPayload); err != nil {
		return
	}

	result := sess.Adapt(statsPayload.FPS, statsPayload.DroppedFrames, statsPayload.BufferSizeKB, time.Now())

	if result.BufferWarn {
		log.Printf("[adaptive] session %s buffer warning: buffer_size_kb=%d (limit=%d)",
			sess.ID, statsPayload.BufferSizeKB, bufferWarnKB)
	}

	if result.Action != "stable" {
		log.Printf("[adaptive] session %s quality %s: bitrate=%dkbps resolution=%s",
			sess.ID, result.Action, result.NewBitrate, result.NewResolution)
		params := QualityParams{BitrateKbps: result.NewBitrate, Resolution: result.NewResolution}
		sess.SendRestart(params)

		// フロントエンドへ品質変更イベントを送信
		event := map[string]interface{}{
			"type":           "quality_change",
			"action":         result.Action,
			"new_bitrate":    result.NewBitrate,
			"new_resolution": result.NewResolution,
		}
		if eventJSON, marshalErr := json.Marshal(event); marshalErr == nil {
			sess.TrySendStats(eventJSON)
		}
	}
}

package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

func ffmpegPath() string {
	path := os.Getenv("FFMPEG_PATH")
	if path == "" {
		log.Fatal("FFMPEG_PATH が設定されていません")
	}
	return path
}

func serverPort() string {
	port := os.Getenv("PORT")
	if port == "" {
		log.Fatal("PORT が設定されていません")
	}
	return ":" + port
}

func frontendOrigin() string {
	origin := os.Getenv("FRONTEND_ORIGIN")
	if origin == "" {
		log.Fatal("FRONTEND_ORIGIN が設定されていません")
	}
	return origin
}

func setupRouter(store *SessionStore, runner FFmpegRunner, allowedOrigin string) *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	h := &Handler{
		store:  store,
		runner: runner,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(req *http.Request) bool {
				return req.Header.Get("Origin") == allowedOrigin
			},
		},
	}

	r.GET("/health", func(c *gin.Context) {
		ffmpeg := ffmpegPath()
		_, err := os.Stat(ffmpeg)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"status": "error",
				"detail": "ffmpeg not found: " + ffmpeg,
			})
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"status":      "ok",
			"ffmpeg_path": ffmpeg,
		})
	})

	r.POST("/bridge/sessions", h.RegisterSession)
	r.DELETE("/bridge/sessions/:id", h.StopSession)
	r.POST("/bridge/sessions/:id/stats", h.PushStats)
	r.GET("/ws", h.HandleWebSocket)

	return r
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println(".env ファイルが見つかりません。環境変数から読み込みます")
	}

	store := NewSessionStore()
	runner := NewFFmpegRunner(ffmpegPath())
	origin := frontendOrigin()

	port := serverPort()
	r := setupRouter(store, runner, origin)

	log.Printf("RTMPブリッジサーバー起動: %s", port)

	if err := r.Run(port); err != nil {
		log.Fatalf("サーバー起動失敗: %v", err)
	}
}

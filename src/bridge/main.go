package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/joho/godotenv"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		allowed := os.Getenv("FRONTEND_ORIGIN")
		if allowed == "" {
			log.Fatal("FRONTEND_ORIGIN が設定されていません")
		}
		return origin == allowed
	},
}

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

func setupRouter() *gin.Engine {
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

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

	r.GET("/ws", func(c *gin.Context) {
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			log.Printf("WebSocket upgrade error: %v", err)
			return
		}
		defer conn.Close()
		log.Println("WebSocket client connected")

		for {
			_, _, err := conn.ReadMessage()
			if err != nil {
				log.Printf("WebSocket read error: %v", err)
				break
			}
		}
	})

	return r
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println(".env ファイルが見つかりません。環境変数から読み込みます")
	}

	port := serverPort()
	r := setupRouter()

	log.Printf("RTMPブリッジサーバー起動: %s", port)
	log.Printf("FFmpeg: %s", ffmpegPath())

	if err := r.Run(port); err != nil {
		log.Fatalf("サーバー起動失敗: %v", err)
	}
}

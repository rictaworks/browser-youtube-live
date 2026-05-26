package main

import (
	"io"
	"os/exec"
)

type FFmpegRunner interface {
	Start(rtmpURL string) (io.WriteCloser, error)
}

type RealFFmpegRunner struct {
	ffmpegPath string
}

func NewFFmpegRunner(path string) *RealFFmpegRunner {
	return &RealFFmpegRunner{ffmpegPath: path}
}

func (r *RealFFmpegRunner) Start(rtmpURL string) (io.WriteCloser, error) {
	// 多層防御: libavformat の出力プロトコルを RTMP 系のみに制限する。
	// バリデーションは handler 側で実施済みだが、ここでも file:/http: 等を遮断する。
	cmd := exec.Command(r.ffmpegPath,
		"-protocol_whitelist", "rtmp,rtmps,tcp,tls,crypto",
		"-re",
		"-i", "pipe:0",
		"-vcodec", "libx264",
		"-acodec", "aac",
		"-f", "flv",
		rtmpURL,
	)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		stdin.Close()
		return nil, err
	}
	return stdin, nil
}

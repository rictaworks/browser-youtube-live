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
	cmd := exec.Command(r.ffmpegPath,
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

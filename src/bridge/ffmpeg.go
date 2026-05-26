package main

import (
	"io"
	"os/exec"
	"syscall"
	"time"
)

// FFmpegProcess は FFmpeg プロセスへの書き込みと停止を抽象化するインターフェース
type FFmpegProcess interface {
	io.WriteCloser
	Stop()
}

type FFmpegRunner interface {
	Start(rtmpURL string) (FFmpegProcess, error)
}

type RealFFmpegRunner struct {
	ffmpegPath string
}

func NewFFmpegRunner(path string) *RealFFmpegRunner {
	return &RealFFmpegRunner{ffmpegPath: path}
}

type realFFmpegProcess struct {
	stdin io.WriteCloser
	cmd   *exec.Cmd
	done  chan struct{}
}

func newRealFFmpegProcess(cmd *exec.Cmd, stdin io.WriteCloser) *realFFmpegProcess {
	p := &realFFmpegProcess{stdin: stdin, cmd: cmd, done: make(chan struct{})}
	go func() {
		cmd.Wait()
		close(p.done)
	}()
	return p
}

func (p *realFFmpegProcess) Write(b []byte) (int, error) { return p.stdin.Write(b) }
func (p *realFFmpegProcess) Close() error                { return p.stdin.Close() }

func (p *realFFmpegProcess) Stop() {
	p.stdin.Close()
	if p.cmd.Process != nil {
		p.cmd.Process.Signal(syscall.SIGTERM)
		select {
		case <-p.done:
		case <-time.After(5 * time.Second):
			p.cmd.Process.Kill()
			<-p.done
		}
	}
}

func (r *RealFFmpegRunner) Start(rtmpURL string) (FFmpegProcess, error) {
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
	return newRealFFmpegProcess(cmd, stdin), nil
}

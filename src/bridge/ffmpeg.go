package main

import (
	"fmt"
	"io"
	"os/exec"
	"sync"
	"syscall"
	"time"
)

// FFmpegProcess は FFmpeg プロセスへの書き込みと停止を抽象化するインターフェース
type FFmpegProcess interface {
	io.WriteCloser
	Stop()
	Done() <-chan struct{}
}

// FFmpegParams は FFmpeg 起動パラメータを保持する。
type FFmpegParams struct {
	RTMPURL     string
	BitrateKbps int // 0 = libx264 デフォルト
}

type FFmpegRunner interface {
	Start(params FFmpegParams) (FFmpegProcess, error)
}

type RealFFmpegRunner struct {
	ffmpegPath string
}

func NewFFmpegRunner(path string) *RealFFmpegRunner {
	return &RealFFmpegRunner{ffmpegPath: path}
}

type realFFmpegProcess struct {
	stdin    io.WriteCloser
	cmd      *exec.Cmd
	done     chan struct{}
	stopOnce sync.Once
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
func (p *realFFmpegProcess) Done() <-chan struct{}        { return p.done }

func (p *realFFmpegProcess) Stop() {
	p.stopOnce.Do(func() {
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
	})
}

func (r *RealFFmpegRunner) Start(params FFmpegParams) (FFmpegProcess, error) {
	// 多層防御: libavformat の出力プロトコルを RTMP 系のみに制限する。
	// バリデーションは handler 側で実施済みだが、ここでも file:/http: 等を遮断する。
	args := []string{
		"-protocol_whitelist", "rtmp,rtmps,tcp,tls,crypto",
		"-re",
		"-i", "pipe:0",
		"-vcodec", "libx264",
	}
	if params.BitrateKbps > 0 {
		args = append(args, "-b:v", fmt.Sprintf("%dk", params.BitrateKbps))
	}
	args = append(args, "-acodec", "aac", "-f", "flv", params.RTMPURL)
	cmd := exec.Command(r.ffmpegPath, args...)
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

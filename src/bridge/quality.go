package main

import (
	"sync"
	"time"
)

const (
	historyWindow  = 10 * time.Second
	upgradeWindow  = 30 * time.Second
	dropThreshold  = 0.05
	bitrateDownFactor = 0.75
	bitrateUpFactor   = 1.25
	minBitrateKbps    = 500
	maxBitrateKbps    = 8000
	bufferWarnKB      = 10 * 1024
	defaultBitrateKbps = 3000
	defaultResolution  = "720p"
)

var resolutionLadder = []string{"360p", "480p", "720p", "1080p"}

// QualityParams はFFmpeg再起動時に使うビットレートと解像度を保持する。
type QualityParams struct {
	BitrateKbps int
	Resolution  string
}

// AdaptResult は適応制御の判断結果を表す。
type AdaptResult struct {
	Action        string // "upgrade" | "downgrade" | "stable"
	NewBitrate    int
	NewResolution string
	BufferWarn    bool
}

type statsEntry struct {
	at            time.Time
	droppedFrames int
	fps           float64
}

// QualityAdapter は直近の統計を保持し、ビットレート・解像度の自動調整を行う。
type QualityAdapter struct {
	mu            sync.Mutex
	bitrateKbps   int
	resIdx        int
	history       []statsEntry
	zeroDropSince *time.Time
}

func NewQualityAdapter(bitrateKbps int, resolution string) *QualityAdapter {
	idx := resolutionIndex(resolution)
	if idx < 0 {
		idx = 2 // default: "720p"
	}
	return &QualityAdapter{
		bitrateKbps: bitrateKbps,
		resIdx:      idx,
	}
}

func resolutionIndex(res string) int {
	for i, r := range resolutionLadder {
		if r == res {
			return i
		}
	}
	return -1
}

func (a *QualityAdapter) CurrentBitrate() int {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.bitrateKbps
}

func (a *QualityAdapter) CurrentResolution() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return resolutionLadder[a.resIdx]
}

// Adapt は新しい統計を受け取り、ビットレート・解像度の調整判断を返す。
func (a *QualityAdapter) Adapt(fps float64, droppedFrames, bufferSizeKB int, now time.Time) AdaptResult {
	a.mu.Lock()
	defer a.mu.Unlock()

	a.history = append(a.history, statsEntry{at: now, droppedFrames: droppedFrames, fps: fps})
	a.trimHistory(now)

	rate := a.dropRate(now)
	totalDropped := 0
	for _, e := range a.history {
		totalDropped += e.droppedFrames
	}
	zeroDropsInWindow := totalDropped == 0

	bufferWarn := bufferSizeKB > bufferWarnKB
	action := "stable"

	switch {
	case len(a.history) >= 2 && rate > dropThreshold:
		// 十分なサンプルがある場合のみダウングレード判定する
		a.zeroDropSince = nil
		newBitrate := int(float64(a.bitrateKbps) * bitrateDownFactor)
		if newBitrate < minBitrateKbps {
			newBitrate = minBitrateKbps
			if a.resIdx > 0 {
				a.resIdx--
			}
		}
		a.bitrateKbps = newBitrate
		action = "downgrade"

	case zeroDropsInWindow:
		// ウィンドウ内のすべてのサンプルでドロップなし → 安定期間を計測
		if a.zeroDropSince == nil {
			t := now
			a.zeroDropSince = &t
		} else if now.Sub(*a.zeroDropSince) >= upgradeWindow {
			newBitrate := int(float64(a.bitrateKbps) * bitrateUpFactor)
			if newBitrate > maxBitrateKbps {
				newBitrate = maxBitrateKbps
			}
			a.bitrateKbps = newBitrate
			a.zeroDropSince = nil
			action = "upgrade"
		}

	default:
		// ドロップあり（閾値未満含む）→ 安定カウンタをリセット
		a.zeroDropSince = nil
	}

	return AdaptResult{
		Action:        action,
		NewBitrate:    a.bitrateKbps,
		NewResolution: resolutionLadder[a.resIdx],
		BufferWarn:    bufferWarn,
	}
}

func (a *QualityAdapter) trimHistory(now time.Time) {
	cutoff := now.Add(-historyWindow)
	j := 0
	for _, e := range a.history {
		if !e.at.Before(cutoff) {
			a.history[j] = e
			j++
		}
	}
	a.history = a.history[:j]
}

func (a *QualityAdapter) dropRate(now time.Time) float64 {
	if len(a.history) == 0 {
		return 0.0
	}

	totalDropped := 0
	totalFPS := 0.0
	for _, e := range a.history {
		totalDropped += e.droppedFrames
		totalFPS += e.fps
	}

	n := float64(len(a.history))
	avgFPS := totalFPS / n

	duration := now.Sub(a.history[0].at).Seconds()
	if duration <= 0 {
		duration = 5.0 // assume default collection interval
	}

	expectedFrames := avgFPS * duration
	if expectedFrames <= 0 {
		return 0.0
	}
	return float64(totalDropped) / expectedFrames
}

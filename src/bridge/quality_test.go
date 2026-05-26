package main

import (
	"testing"
	"time"
)

func TestNewQualityAdapter_InitialState(t *testing.T) {
	a := NewQualityAdapter(3000, "720p")
	if a.CurrentBitrate() != 3000 {
		t.Errorf("expected bitrate=3000, got %d", a.CurrentBitrate())
	}
	if a.CurrentResolution() != "720p" {
		t.Errorf("expected resolution=720p, got %s", a.CurrentResolution())
	}
}

func TestNewQualityAdapter_UnknownResolutionDefaultsTo720p(t *testing.T) {
	a := NewQualityAdapter(3000, "unknown")
	if a.CurrentResolution() != "720p" {
		t.Errorf("expected default 720p for unknown resolution, got %s", a.CurrentResolution())
	}
}

func TestQualityAdapter_Adapt_StableWhenNoDrops(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(3000, "720p")

	result := a.Adapt(30.0, 0, 256, now)
	if result.Action != "stable" {
		t.Errorf("expected stable, got %s", result.Action)
	}
	if result.NewBitrate != 3000 {
		t.Errorf("expected bitrate unchanged at 3000, got %d", result.NewBitrate)
	}
}

func TestQualityAdapter_Adapt_DowngradeWhenDropRateExceedsThreshold(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(3000, "720p")

	// fps=30, dropped=8 per interval over 5s window
	// total dropped=16, expected=30*5=150 → dropRate=10.67% > 5%
	a.Adapt(30.0, 8, 256, now.Add(-5*time.Second))
	result := a.Adapt(30.0, 8, 256, now)

	if result.Action != "downgrade" {
		t.Errorf("expected downgrade when drop_rate > 5%%, got %s", result.Action)
	}
	if result.NewBitrate != 2250 {
		t.Errorf("expected NewBitrate=2250 (3000*0.75), got %d", result.NewBitrate)
	}
	if result.NewResolution != "720p" {
		t.Errorf("expected resolution unchanged at 720p, got %s", result.NewResolution)
	}
}

func TestQualityAdapter_Adapt_DowngradeClampsToMinBitrateAndFallsBackResolution(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(600, "720p")

	// 600*0.75=450 < 500(min) → clamp to 500 + resolution fallback
	a.Adapt(30.0, 4, 256, now.Add(-5*time.Second))
	result := a.Adapt(30.0, 4, 256, now)

	if result.NewBitrate != minBitrateKbps {
		t.Errorf("expected minBitrate=%d, got %d", minBitrateKbps, result.NewBitrate)
	}
	if result.NewResolution != "480p" {
		t.Errorf("expected resolution fallback to 480p from 720p, got %s", result.NewResolution)
	}
}

func TestQualityAdapter_Adapt_ResolutionStaysAt360pIfAlreadyLowest(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(minBitrateKbps, "360p") // already at minimum

	a.Adapt(30.0, 4, 256, now.Add(-5*time.Second))
	result := a.Adapt(30.0, 4, 256, now)

	if result.NewResolution != "360p" {
		t.Errorf("expected resolution stays at 360p, got %s", result.NewResolution)
	}
	if result.NewBitrate != minBitrateKbps {
		t.Errorf("expected bitrate stays at min=%d, got %d", minBitrateKbps, result.NewBitrate)
	}
}

func TestQualityAdapter_Adapt_UpgradeAfterStableWindow(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(2000, "720p")

	// First zero-drop entry 31s ago → zeroDropSince = now-31s
	a.Adapt(30.0, 0, 256, now.Add(-31*time.Second))
	result := a.Adapt(30.0, 0, 256, now)

	if result.Action != "upgrade" {
		t.Errorf("expected upgrade after 30s stable period, got %s", result.Action)
	}
	if result.NewBitrate != 2500 {
		t.Errorf("expected NewBitrate=2500 (2000*1.25), got %d", result.NewBitrate)
	}
}

func TestQualityAdapter_Adapt_NoUpgradeBeforeStableWindow(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(2000, "720p")

	// Only 20s of zero drops — not yet 30s
	a.Adapt(30.0, 0, 256, now.Add(-20*time.Second))
	result := a.Adapt(30.0, 0, 256, now)

	if result.Action != "stable" {
		t.Errorf("expected stable (not 30s yet), got %s", result.Action)
	}
}

func TestQualityAdapter_Adapt_UpgradeClampsToMaxBitrate(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(maxBitrateKbps, "720p") // already at max

	a.Adapt(30.0, 0, 256, now.Add(-31*time.Second))
	result := a.Adapt(30.0, 0, 256, now)

	if result.Action != "upgrade" {
		t.Errorf("expected upgrade action even at max bitrate, got %s", result.Action)
	}
	if result.NewBitrate != maxBitrateKbps {
		t.Errorf("expected bitrate clamped at max=%d, got %d", maxBitrateKbps, result.NewBitrate)
	}
}

func TestQualityAdapter_Adapt_DropsResetStableCounter(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(2000, "720p")

	// 20s of zero drops → zeroDropSince set
	a.Adapt(30.0, 0, 256, now.Add(-20*time.Second))
	a.Adapt(30.0, 0, 256, now.Add(-10*time.Second))

	// A drop resets the stable counter (even if below 5% threshold)
	a.Adapt(30.0, 5, 256, now.Add(-5*time.Second))

	// Still within the window: no upgrade even though current entry has 0 drops
	result := a.Adapt(30.0, 0, 256, now)
	if result.Action == "upgrade" {
		t.Error("expected no upgrade because drops in window reset stable counter")
	}
}

func TestQualityAdapter_Adapt_BufferWarnWhenExceeds10MB(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(3000, "720p")

	result := a.Adapt(30.0, 0, bufferWarnKB+1, now)
	if !result.BufferWarn {
		t.Errorf("expected BufferWarn=true when buffer_size_kb=%d > %d", bufferWarnKB+1, bufferWarnKB)
	}
}

func TestQualityAdapter_Adapt_NoBufferWarnAtExactLimit(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(3000, "720p")

	result := a.Adapt(30.0, 0, bufferWarnKB, now)
	if result.BufferWarn {
		t.Errorf("expected BufferWarn=false when buffer_size_kb=%d (at limit)", bufferWarnKB)
	}
}

func TestQualityAdapter_CurrentBitrateAndResolution_UpdateAfterAdapt(t *testing.T) {
	now := time.Now()
	a := NewQualityAdapter(3000, "720p")

	a.Adapt(30.0, 8, 256, now.Add(-5*time.Second))
	a.Adapt(30.0, 8, 256, now)

	if a.CurrentBitrate() != 2250 {
		t.Errorf("expected CurrentBitrate=2250 after downgrade, got %d", a.CurrentBitrate())
	}
	if a.CurrentResolution() != "720p" {
		t.Errorf("expected CurrentResolution=720p (unchanged), got %s", a.CurrentResolution())
	}
}

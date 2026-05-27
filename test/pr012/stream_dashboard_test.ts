/**
 * @jest-environment jsdom
 */
/**
 * PR012 統合テスト: ステータス監視ダッシュボード
 * 対象: src/frontend/src/components/StreamDashboard.tsx
 *       src/frontend/src/hooks/useStreamStats.ts
 */

import { render, screen, renderHook, act } from "@testing-library/react";
import { StreamDashboard } from "../../src/frontend/src/components/StreamDashboard";
import {
  useStreamStats,
  type StreamStats,
} from "../../src/frontend/src/hooks/useStreamStats";
import type { QualityChangeEvent } from "../../src/frontend/src/hooks/useQualityChange";

const baseStats: StreamStats = {
  bitrate_kbps: 3000,
  fps: 30,
  dropped_frames: 5,
  viewer_count: 42,
  buffer_size_kb: 256,
  elapsed_seconds: 3661,
  status: "live",
};

// --- StreamDashboard 待機状態 ---

describe("[PR012] StreamDashboard 待機状態", () => {
  test("stats が null のとき待機メッセージを表示する", () => {
    render(StreamDashboard({ stats: null }));
    expect(screen.getByText(/待機中/)).toBeInTheDocument();
  });
});

// --- StreamDashboard 統計表示 ---

describe("[PR012] StreamDashboard 統計表示", () => {
  test("ビットレートを kbps 単位で表示する", () => {
    render(StreamDashboard({ stats: baseStats }));
    expect(screen.getByText("3000")).toBeInTheDocument();
  });

  test("視聴者数を表示する", () => {
    render(StreamDashboard({ stats: baseStats }));
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("FPS を表示する", () => {
    render(StreamDashboard({ stats: baseStats }));
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  test("ドロップフレーム数を表示する", () => {
    render(StreamDashboard({ stats: baseStats }));
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  test('viewer_count が null のとき "-" を表示する', () => {
    render(StreamDashboard({ stats: { ...baseStats, viewer_count: null } }));
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });
});

// --- StreamDashboard 経過時間フォーマット ---

describe("[PR012] StreamDashboard 経過時間 HH:MM:SS フォーマット", () => {
  test("3661 秒 → 01:01:01 と表示する", () => {
    render(StreamDashboard({ stats: { ...baseStats, elapsed_seconds: 3661 } }));
    expect(screen.getByText("01:01:01")).toBeInTheDocument();
  });

  test("0 秒 → 00:00:00 と表示する", () => {
    render(StreamDashboard({ stats: { ...baseStats, elapsed_seconds: 0 } }));
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
  });

  test("59 秒 → 00:00:59 と表示する", () => {
    render(StreamDashboard({ stats: { ...baseStats, elapsed_seconds: 59 } }));
    expect(screen.getByText("00:00:59")).toBeInTheDocument();
  });

  test("3600 秒 → 01:00:00 と表示する", () => {
    render(StreamDashboard({ stats: { ...baseStats, elapsed_seconds: 3600 } }));
    expect(screen.getByText("01:00:00")).toBeInTheDocument();
  });

  test("90 秒 → 00:01:30 と表示する", () => {
    render(StreamDashboard({ stats: { ...baseStats, elapsed_seconds: 90 } }));
    expect(screen.getByText("00:01:30")).toBeInTheDocument();
  });
});

// --- StreamDashboard 品質変更通知 ---

describe("[PR012] StreamDashboard 品質変更通知", () => {
  test("downgrade イベント時に品質低下バナーを表示する", () => {
    const downgrade: QualityChangeEvent = {
      type: "quality_change",
      action: "downgrade",
      new_bitrate: 2250,
      new_resolution: "720p",
    };
    render(StreamDashboard({ stats: baseStats, qualityChange: downgrade }));
    const banner = screen.getByText(/品質低下/);
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain("2250");
    expect(banner.textContent).toContain("720p");
  });

  test("upgrade イベント時に品質改善バナーを表示する", () => {
    const upgrade: QualityChangeEvent = {
      type: "quality_change",
      action: "upgrade",
      new_bitrate: 4000,
      new_resolution: "1080p",
    };
    render(StreamDashboard({ stats: baseStats, qualityChange: upgrade }));
    expect(screen.getByText(/品質改善/)).toBeInTheDocument();
  });

  test("qualityChange が未指定のとき品質通知バナーを表示しない", () => {
    render(StreamDashboard({ stats: baseStats }));
    expect(screen.queryByText(/品質低下/)).not.toBeInTheDocument();
    expect(screen.queryByText(/品質改善/)).not.toBeInTheDocument();
  });
});

// --- useStreamStats ---

describe("[PR012] useStreamStats WebSocket 受信", () => {
  let mockWs: EventTarget & { readyState: number };

  beforeEach(() => {
    mockWs = Object.assign(new EventTarget(), { readyState: 1 });
  });

  test("ws が null のとき null を返す", () => {
    const { result } = renderHook(() => useStreamStats(null));
    expect(result.current).toBeNull();
  });

  test("stats メッセージを受信して値を更新する", () => {
    const { result } = renderHook(() =>
      useStreamStats(mockWs as unknown as WebSocket),
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), {
          data: JSON.stringify(baseStats),
        }),
      );
    });

    expect(result.current).toEqual(baseStats);
  });

  test("quality_change タイプのメッセージは無視する", () => {
    const { result } = renderHook(() =>
      useStreamStats(mockWs as unknown as WebSocket),
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), {
          data: JSON.stringify({
            type: "quality_change",
            action: "downgrade",
            new_bitrate: 2000,
            new_resolution: "720p",
          }),
        }),
      );
    });

    expect(result.current).toBeNull();
  });

  test("不正な JSON は無視する", () => {
    const { result } = renderHook(() =>
      useStreamStats(mockWs as unknown as WebSocket),
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), { data: "invalid-json{{" }),
      );
    });

    expect(result.current).toBeNull();
  });

  test("バイナリメッセージは無視する", () => {
    const { result } = renderHook(() =>
      useStreamStats(mockWs as unknown as WebSocket),
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), { data: new ArrayBuffer(8) }),
      );
    });

    expect(result.current).toBeNull();
  });

  test("ws が null に変わったとき stats をリセットする", () => {
    const { result, rerender } = renderHook(
      ({ ws }: { ws: WebSocket | null }) => useStreamStats(ws),
      { initialProps: { ws: mockWs as unknown as WebSocket } },
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), {
          data: JSON.stringify(baseStats),
        }),
      );
    });
    expect(result.current).not.toBeNull();

    rerender({ ws: null });
    expect(result.current).toBeNull();
  });
});

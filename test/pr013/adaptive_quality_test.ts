/**
 * PR013 統合テスト: アダプティブ品質制御（フレームドロップ監視・ビットレート自動調整）
 * 対象: src/frontend/src/hooks/useQualityChange.ts
 */

import { renderHook, act } from "@testing-library/react";
import {
  useQualityChange,
  type QualityChangeEvent,
} from "../../src/frontend/src/hooks/useQualityChange";

// --- useQualityChange ---

describe("[PR013] useQualityChange 初期状態", () => {
  test("ws が null のとき null を返す", () => {
    const { result } = renderHook(() => useQualityChange(null));
    expect(result.current).toBeNull();
  });
});

describe("[PR013] useQualityChange quality_change イベント処理", () => {
  let mockWs: EventTarget & { readyState: number };

  beforeEach(() => {
    mockWs = Object.assign(new EventTarget(), { readyState: 1 });
  });

  test("downgrade イベントを受信して状態を更新する", () => {
    const { result } = renderHook(() =>
      useQualityChange(mockWs as unknown as WebSocket),
    );

    const event: QualityChangeEvent = {
      type: "quality_change",
      action: "downgrade",
      new_bitrate: 2250,
      new_resolution: "720p",
    };

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), { data: JSON.stringify(event) }),
      );
    });

    expect(result.current).toEqual(event);
  });

  test("upgrade イベントを受信して状態を更新する", () => {
    const { result } = renderHook(() =>
      useQualityChange(mockWs as unknown as WebSocket),
    );

    const event: QualityChangeEvent = {
      type: "quality_change",
      action: "upgrade",
      new_bitrate: 4000,
      new_resolution: "1080p",
    };

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), { data: JSON.stringify(event) }),
      );
    });

    expect(result.current?.action).toBe("upgrade");
    expect(result.current?.new_bitrate).toBe(4000);
    expect(result.current?.new_resolution).toBe("1080p");
  });

  test("type が quality_change 以外のメッセージは無視する", () => {
    const { result } = renderHook(() =>
      useQualityChange(mockWs as unknown as WebSocket),
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), {
          data: JSON.stringify({
            bitrate_kbps: 3000,
            fps: 30,
            dropped_frames: 0,
            viewer_count: 10,
            buffer_size_kb: 100,
            elapsed_seconds: 60,
            status: "live",
          }),
        }),
      );
    });

    expect(result.current).toBeNull();
  });

  test("不正な JSON は無視する", () => {
    const { result } = renderHook(() =>
      useQualityChange(mockWs as unknown as WebSocket),
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), { data: "{invalid" }),
      );
    });

    expect(result.current).toBeNull();
  });

  test("バイナリメッセージは無視する", () => {
    const { result } = renderHook(() =>
      useQualityChange(mockWs as unknown as WebSocket),
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event("message"), { data: new ArrayBuffer(16) }),
      );
    });

    expect(result.current).toBeNull();
  });
});

describe("[PR013] useQualityChange ws 変更時のクリーンアップ", () => {
  test("ws が null に変わったとき event をリセットする", () => {
    const mockWs = Object.assign(new EventTarget(), { readyState: 1 });
    const { result, rerender } = renderHook(
      ({ ws }: { ws: WebSocket | null }) => useQualityChange(ws),
      { initialProps: { ws: mockWs as unknown as WebSocket } },
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
    expect(result.current).not.toBeNull();

    rerender({ ws: null });
    expect(result.current).toBeNull();
  });

  test("ws 切り替え後は古いリスナーを削除する", () => {
    const mockWs = Object.assign(new EventTarget(), { readyState: 1 });
    const removeSpy = jest.spyOn(mockWs, "removeEventListener");

    const { rerender } = renderHook(
      ({ ws }: { ws: WebSocket | null }) => useQualityChange(ws),
      { initialProps: { ws: mockWs as unknown as WebSocket } },
    );

    rerender({ ws: null });
    expect(removeSpy).toHaveBeenCalledWith("message", expect.any(Function));
  });
});

describe("[PR013] QualityChangeEvent 型フィールド", () => {
  test('type は "quality_change" 固定である', () => {
    const ev: QualityChangeEvent = {
      type: "quality_change",
      action: "downgrade",
      new_bitrate: 1500,
      new_resolution: "480p",
    };
    expect(ev.type).toBe("quality_change");
  });

  test('action は "upgrade" または "downgrade" のいずれかである', () => {
    const actions: QualityChangeEvent["action"][] = ["upgrade", "downgrade"];
    actions.forEach((a) => {
      const ev: QualityChangeEvent = {
        type: "quality_change",
        action: a,
        new_bitrate: 3000,
        new_resolution: "720p",
      };
      expect(["upgrade", "downgrade"]).toContain(ev.action);
    });
  });

  test("new_bitrate は number である", () => {
    const ev: QualityChangeEvent = {
      type: "quality_change",
      action: "upgrade",
      new_bitrate: 6000,
      new_resolution: "1080p",
    };
    expect(typeof ev.new_bitrate).toBe("number");
  });
});

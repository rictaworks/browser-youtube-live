import { renderHook, act } from '@testing-library/react';
import { useStreamStats, StreamStats } from '@/hooks/useStreamStats';

describe('useStreamStats', () => {
  let mockWs: EventTarget & {
    send: jest.Mock;
    close: jest.Mock;
    readyState: number;
  };

  beforeEach(() => {
    mockWs = Object.assign(new EventTarget(), {
      send: jest.fn(),
      close: jest.fn(),
      readyState: WebSocket.OPEN,
    });
  });

  test('wsがnullの場合はnullを返す', () => {
    const { result } = renderHook(() => useStreamStats(null));
    expect(result.current).toBeNull();
  });

  test('テキストメッセージを受信してstatsを更新する', () => {
    const { result } = renderHook(() => useStreamStats(mockWs as unknown as WebSocket));

    const statsData: StreamStats = {
      bitrate_kbps: 3000,
      fps: 30.0,
      dropped_frames: 2,
      viewer_count: 42,
      buffer_size_kb: 256,
      elapsed_seconds: 120,
      status: 'live',
    };

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event('message'), { data: JSON.stringify(statsData) })
      );
    });

    expect(result.current).toEqual(statsData);
  });

  test('バイナリメッセージ（ArrayBuffer）は無視する', () => {
    const { result } = renderHook(() => useStreamStats(mockWs as unknown as WebSocket));

    act(() => {
      mockWs.dispatchEvent(Object.assign(new Event('message'), { data: new ArrayBuffer(8) }));
    });

    expect(result.current).toBeNull();
  });

  test('不正なJSONは無視する', () => {
    const { result } = renderHook(() => useStreamStats(mockWs as unknown as WebSocket));

    act(() => {
      mockWs.dispatchEvent(Object.assign(new Event('message'), { data: 'invalid-json' }));
    });

    expect(result.current).toBeNull();
  });

  test('wsがnullに変わったときstatsをリセットする', () => {
    const { result, rerender } = renderHook(
      ({ ws }: { ws: WebSocket | null }) => useStreamStats(ws),
      { initialProps: { ws: mockWs as unknown as WebSocket } }
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event('message'), {
          data: JSON.stringify({
            bitrate_kbps: 1000,
            fps: 30,
            dropped_frames: 0,
            viewer_count: 5,
            buffer_size_kb: 100,
            elapsed_seconds: 10,
            status: 'live',
          }),
        })
      );
    });

    expect(result.current).not.toBeNull();

    rerender({ ws: null as unknown as WebSocket });
    expect(result.current).toBeNull();
  });

  test('ws切り替え後は古いイベントリスナーを削除する', () => {
    const removeEventListenerSpy = jest.spyOn(mockWs, 'removeEventListener');

    const { rerender } = renderHook(({ ws }: { ws: WebSocket | null }) => useStreamStats(ws), {
      initialProps: { ws: mockWs as unknown as WebSocket },
    });

    rerender({ ws: null as unknown as WebSocket });
    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });
});

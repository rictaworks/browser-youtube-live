import { renderHook, act } from '@testing-library/react';
import { useQualityChange, QualityChangeEvent } from '@/hooks/useQualityChange';

describe('useQualityChange', () => {
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
    const { result } = renderHook(() => useQualityChange(null));
    expect(result.current).toBeNull();
  });

  test('quality_changeイベントを受信してstateを更新する', () => {
    const { result } = renderHook(() => useQualityChange(mockWs as unknown as WebSocket));

    const event: QualityChangeEvent = {
      type: 'quality_change',
      action: 'downgrade',
      new_bitrate: 2250,
      new_resolution: '720p',
    };

    act(() => {
      mockWs.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify(event) }));
    });

    expect(result.current).toEqual(event);
  });

  test('upgradeイベントも受信できる', () => {
    const { result } = renderHook(() => useQualityChange(mockWs as unknown as WebSocket));

    const event: QualityChangeEvent = {
      type: 'quality_change',
      action: 'upgrade',
      new_bitrate: 3750,
      new_resolution: '720p',
    };

    act(() => {
      mockWs.dispatchEvent(Object.assign(new Event('message'), { data: JSON.stringify(event) }));
    });

    expect(result.current).toEqual(event);
  });

  test('type=quality_change以外のメッセージは無視する', () => {
    const { result } = renderHook(() => useQualityChange(mockWs as unknown as WebSocket));

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event('message'), {
          data: JSON.stringify({ bitrate_kbps: 3000, fps: 30 }),
        })
      );
    });

    expect(result.current).toBeNull();
  });

  test('バイナリメッセージは無視する', () => {
    const { result } = renderHook(() => useQualityChange(mockWs as unknown as WebSocket));

    act(() => {
      mockWs.dispatchEvent(Object.assign(new Event('message'), { data: new ArrayBuffer(8) }));
    });

    expect(result.current).toBeNull();
  });

  test('不正なJSONは無視する', () => {
    const { result } = renderHook(() => useQualityChange(mockWs as unknown as WebSocket));

    act(() => {
      mockWs.dispatchEvent(Object.assign(new Event('message'), { data: 'invalid-json' }));
    });

    expect(result.current).toBeNull();
  });

  test('wsがnullに変わったとき状態をリセットする', () => {
    const { result, rerender } = renderHook(
      ({ ws }: { ws: WebSocket | null }) => useQualityChange(ws),
      { initialProps: { ws: mockWs as unknown as WebSocket } }
    );

    act(() => {
      mockWs.dispatchEvent(
        Object.assign(new Event('message'), {
          data: JSON.stringify({
            type: 'quality_change',
            action: 'downgrade',
            new_bitrate: 2250,
            new_resolution: '720p',
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

    const { rerender } = renderHook(({ ws }: { ws: WebSocket | null }) => useQualityChange(ws), {
      initialProps: { ws: mockWs as unknown as WebSocket },
    });

    rerender({ ws: null as unknown as WebSocket });
    expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
  });
});

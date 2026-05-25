import { startMix, stopMix, CanvasMixerState } from '@/hooks/useCanvasMixer';
import * as canvasMixer from '@/lib/canvasMixer';

jest.mock('@/lib/canvasMixer');
const mockStartCanvasMix = canvasMixer.startCanvasMix as jest.MockedFunction<typeof canvasMixer.startCanvasMix>;

const mockTrack = { stop: jest.fn() };
const mockMixedStream = { getTracks: jest.fn(() => [mockTrack]) } as unknown as MediaStream;
const mockStop = jest.fn();
const mockScreenStream = {} as MediaStream;
const mockCameraStream = {} as MediaStream;

beforeEach(() => {
  jest.clearAllMocks();
  mockStartCanvasMix.mockReturnValue({ stream: mockMixedStream, stop: mockStop });
});

describe('startMix', () => {
  test('idle から mixing に遷移する', () => {
    const state: CanvasMixerState = { status: 'idle' };
    const result = startMix(state, mockScreenStream, mockCameraStream);

    expect(result.status).toBe('mixing');
  });

  test('mixing 状態のとき mixedStream を持つ', () => {
    const state: CanvasMixerState = { status: 'idle' };
    const result = startMix(state, mockScreenStream, mockCameraStream);

    if (result.status === 'mixing') {
      expect(result.mixedStream).toBe(mockMixedStream);
    }
  });

  test('startCanvasMix が呼ばれる', () => {
    const state: CanvasMixerState = { status: 'idle' };
    startMix(state, mockScreenStream, mockCameraStream);

    expect(mockStartCanvasMix).toHaveBeenCalledWith(
      expect.objectContaining({
        screenStream: mockScreenStream,
        cameraStream: mockCameraStream,
      })
    );
  });

  test('すでに mixing 中の場合は先に停止してから開始する', () => {
    const state: CanvasMixerState = {
      status: 'mixing',
      mixedStream: mockMixedStream,
      stopMixing: mockStop,
    };

    startMix(state, mockScreenStream, mockCameraStream);

    expect(mockStop).toHaveBeenCalled();
  });
});

describe('stopMix', () => {
  test('mixing 状態から idle に遷移する', () => {
    const state: CanvasMixerState = {
      status: 'mixing',
      mixedStream: mockMixedStream,
      stopMixing: mockStop,
    };

    const result = stopMix(state);

    expect(mockStop).toHaveBeenCalled();
    expect(result.status).toBe('idle');
  });

  test('idle 状態ではそのまま idle を返す', () => {
    const state: CanvasMixerState = { status: 'idle' };
    const result = stopMix(state);
    expect(result.status).toBe('idle');
  });
});

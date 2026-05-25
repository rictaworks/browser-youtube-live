import { captureUserMedia } from '@/lib/captureUserMedia';
import { startCapture, stopCapture, UserMediaState } from '@/hooks/useUserMedia';

jest.mock('@/lib/captureUserMedia');
const mockCaptureUserMedia = captureUserMedia as jest.MockedFunction<typeof captureUserMedia>;

const mockTrack = { stop: jest.fn() };
const mockStream = { getTracks: jest.fn(() => [mockTrack]) } as unknown as MediaStream;
const mockRecorder = { stop: jest.fn(), state: 'inactive' } as unknown as MediaRecorder;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startCapture', () => {
  test('idle 状態から capturing に遷移する', async () => {
    mockCaptureUserMedia.mockResolvedValue({ stream: mockStream, recorder: mockRecorder });

    const state: UserMediaState = { status: 'idle' };
    const result = await startCapture(state, { video: true, audio: true, quality: '720p' });

    expect(result.status).toBe('capturing');
  });

  test('capturing 状態のとき stream と recorder を持つ', async () => {
    mockCaptureUserMedia.mockResolvedValue({ stream: mockStream, recorder: mockRecorder });

    const state: UserMediaState = { status: 'idle' };
    const result = await startCapture(state, { video: true, audio: true, quality: '720p' });

    if (result.status === 'capturing') {
      expect(result.stream).toBe(mockStream);
      expect(result.recorder).toBe(mockRecorder);
    }
  });

  test('権限拒否エラーで error 状態に遷移する', async () => {
    const err = Object.assign(new Error('PermissionDeniedError'), { name: 'PermissionDeniedError' });
    mockCaptureUserMedia.mockRejectedValue(err);

    const state: UserMediaState = { status: 'idle' };
    const result = await startCapture(state, { video: true, audio: true, quality: '720p' });

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.name).toBe('PermissionDeniedError');
    }
  });

  test('デバイス未検出エラーで error 状態に遷移する', async () => {
    const err = Object.assign(new Error('DeviceNotFoundError'), { name: 'DeviceNotFoundError' });
    mockCaptureUserMedia.mockRejectedValue(err);

    const state: UserMediaState = { status: 'idle' };
    const result = await startCapture(state, { video: true, audio: true, quality: '720p' });

    expect(result.status).toBe('error');
  });
});

describe('stopCapture', () => {
  test('capturing 状態からトラックを停止して idle に遷移する', () => {
    const state: UserMediaState = {
      status: 'capturing',
      stream: mockStream,
      recorder: mockRecorder,
    };

    const result = stopCapture(state);

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(result.status).toBe('idle');
  });

  test('idle 状態ではそのまま idle を返す', () => {
    const state: UserMediaState = { status: 'idle' };
    const result = stopCapture(state);
    expect(result.status).toBe('idle');
  });
});

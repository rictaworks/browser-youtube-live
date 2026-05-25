import { captureDisplayMedia } from '@/lib/captureDisplayMedia';
import { startScreenCapture, stopScreenCapture, DisplayMediaState } from '@/hooks/useDisplayMedia';

jest.mock('@/lib/captureDisplayMedia');
const mockCaptureDisplayMedia = captureDisplayMedia as jest.MockedFunction<typeof captureDisplayMedia>;

const mockTrack = { stop: jest.fn() };
const mockStream = { getTracks: jest.fn(() => [mockTrack]) } as unknown as MediaStream;
const mockRecorder = { stop: jest.fn(), state: 'inactive' } as unknown as MediaRecorder;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('startScreenCapture', () => {
  test('idle 状態から capturing に遷移する', async () => {
    mockCaptureDisplayMedia.mockResolvedValue({ stream: mockStream, recorder: mockRecorder });

    const result = await startScreenCapture();

    expect(result.status).toBe('capturing');
  });

  test('capturing 状態のとき stream と recorder を持つ', async () => {
    mockCaptureDisplayMedia.mockResolvedValue({ stream: mockStream, recorder: mockRecorder });

    const result = await startScreenCapture();

    if (result.status === 'capturing') {
      expect(result.stream).toBe(mockStream);
      expect(result.recorder).toBe(mockRecorder);
    }
  });

  test('権限拒否で error 状態に遷移する', async () => {
    const err = Object.assign(new Error('PermissionDeniedError'), { name: 'PermissionDeniedError' });
    mockCaptureDisplayMedia.mockRejectedValue(err);

    const result = await startScreenCapture();

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.name).toBe('PermissionDeniedError');
    }
  });

  test('未対応ブラウザで error 状態に遷移する', async () => {
    const err = Object.assign(new Error('NotSupportedError'), { name: 'NotSupportedError' });
    mockCaptureDisplayMedia.mockRejectedValue(err);

    const result = await startScreenCapture();

    expect(result.status).toBe('error');
  });
});

describe('stopScreenCapture', () => {
  test('capturing 状態からトラックを停止して idle に遷移する', () => {
    const state: DisplayMediaState = {
      status: 'capturing',
      stream: mockStream,
      recorder: mockRecorder,
    };

    const result = stopScreenCapture(state);

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(result.status).toBe('idle');
  });

  test('idle 状態ではそのまま idle を返す', () => {
    const state: DisplayMediaState = { status: 'idle' };
    const result = stopScreenCapture(state);
    expect(result.status).toBe('idle');
  });
});

import { captureDisplayMedia } from '@/lib/captureDisplayMedia';

const mockStream = { getTracks: jest.fn(() => []) } as unknown as MediaStream;
const mockRecorder = {} as MediaRecorder;
const mockGetDisplayMedia = jest.fn();
const mockMediaRecorder = jest.fn(() => mockRecorder);

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getDisplayMedia: mockGetDisplayMedia },
    configurable: true,
    writable: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).MediaRecorder = Object.assign(mockMediaRecorder, {
    isTypeSupported: jest.fn(() => true),
  });
});

describe('captureDisplayMedia', () => {
  test('getDisplayMedia が呼ばれる', async () => {
    mockGetDisplayMedia.mockResolvedValue(mockStream);

    await captureDisplayMedia();

    expect(mockGetDisplayMedia).toHaveBeenCalled();
  });

  test('video: true で呼ばれる', async () => {
    mockGetDisplayMedia.mockResolvedValue(mockStream);

    await captureDisplayMedia();

    expect(mockGetDisplayMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: true })
    );
  });

  test('stream と recorder を返す', async () => {
    mockGetDisplayMedia.mockResolvedValue(mockStream);

    const result = await captureDisplayMedia();

    expect(result.stream).toBe(mockStream);
    expect(result.recorder).toBe(mockRecorder);
  });

  test('MediaRecorder が正しい mimeType で初期化される', async () => {
    mockGetDisplayMedia.mockResolvedValue(mockStream);

    await captureDisplayMedia();

    expect(mockMediaRecorder).toHaveBeenCalledWith(mockStream, {
      mimeType: 'video/webm;codecs=vp8,opus',
    });
  });

  test('権限拒否・キャンセル時に PermissionDeniedError を投げる', async () => {
    const err = new Error('Permission denied');
    err.name = 'NotAllowedError';
    mockGetDisplayMedia.mockRejectedValue(err);

    await expect(captureDisplayMedia()).rejects.toThrow('PermissionDeniedError');
  });

  test('getDisplayMedia 未対応ブラウザで NotSupportedError を投げる', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {},
      configurable: true,
      writable: true,
    });

    await expect(captureDisplayMedia()).rejects.toThrow('NotSupportedError');
  });

  test('mediaDevices 自体がない場合も NotSupportedError を投げる', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: null,
      configurable: true,
      writable: true,
    });

    await expect(captureDisplayMedia()).rejects.toThrow('NotSupportedError');
  });
});

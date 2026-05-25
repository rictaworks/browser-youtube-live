import { captureUserMedia, QUALITY_CONSTRAINTS } from '@/lib/captureUserMedia';

const mockStream = { getTracks: jest.fn(() => []) } as unknown as MediaStream;
const mockRecorder = {} as MediaRecorder;

const mockGetUserMedia = jest.fn();
const mockMediaRecorder = jest.fn(() => mockRecorder);

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    configurable: true,
    writable: true,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).MediaRecorder = Object.assign(mockMediaRecorder, {
    isTypeSupported: jest.fn(() => true),
  });
});

describe('QUALITY_CONSTRAINTS', () => {
  test('1080p の制約が正しい', () => {
    expect(QUALITY_CONSTRAINTS['1080p']).toEqual({ width: 1920, height: 1080, frameRate: 30 });
  });

  test('720p の制約が正しい', () => {
    expect(QUALITY_CONSTRAINTS['720p']).toEqual({ width: 1280, height: 720, frameRate: 30 });
  });

  test('480p の制約が正しい', () => {
    expect(QUALITY_CONSTRAINTS['480p']).toEqual({ width: 854, height: 480, frameRate: 30 });
  });
});

describe('captureUserMedia', () => {
  test('カメラ+マイクで getUserMedia が呼ばれる', async () => {
    mockGetUserMedia.mockResolvedValue(mockStream);

    await captureUserMedia({ video: true, audio: true, quality: '720p' });

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      video: { width: 1280, height: 720, frameRate: 30 },
      audio: true,
    });
  });

  test('720p の制約で呼ばれる', async () => {
    mockGetUserMedia.mockResolvedValue(mockStream);

    await captureUserMedia({ video: true, audio: true, quality: '720p' });

    expect(mockGetUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: { width: 1280, height: 720, frameRate: 30 },
      })
    );
  });

  test('1080p の制約で呼ばれる', async () => {
    mockGetUserMedia.mockResolvedValue(mockStream);

    await captureUserMedia({ video: true, audio: true, quality: '1080p' });

    expect(mockGetUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: { width: 1920, height: 1080, frameRate: 30 },
      })
    );
  });

  test('stream と recorder を返す', async () => {
    mockGetUserMedia.mockResolvedValue(mockStream);

    const result = await captureUserMedia({ video: true, audio: true, quality: '720p' });

    expect(result.stream).toBe(mockStream);
    expect(result.recorder).toBe(mockRecorder);
  });

  test('MediaRecorder が正しい mimeType で初期化される', async () => {
    mockGetUserMedia.mockResolvedValue(mockStream);

    await captureUserMedia({ video: true, audio: true, quality: '720p' });

    expect(mockMediaRecorder).toHaveBeenCalledWith(mockStream, {
      mimeType: 'video/webm;codecs=vp8,opus',
    });
  });

  test('権限拒否時に PermissionDeniedError を投げる', async () => {
    const err = new Error('Permission denied');
    err.name = 'NotAllowedError';
    mockGetUserMedia.mockRejectedValue(err);

    await expect(captureUserMedia({ video: true, audio: true, quality: '720p' })).rejects.toThrow(
      'PermissionDeniedError'
    );
  });

  test('デバイス未検出時に DeviceNotFoundError を投げる', async () => {
    const err = new Error('Device not found');
    err.name = 'NotFoundError';
    mockGetUserMedia.mockRejectedValue(err);

    await expect(captureUserMedia({ video: true, audio: true, quality: '720p' })).rejects.toThrow(
      'DeviceNotFoundError'
    );
  });

  test('その他のエラーはそのまま再スローする', async () => {
    const err = new Error('Unknown error');
    err.name = 'UnknownError';
    mockGetUserMedia.mockRejectedValue(err);

    await expect(captureUserMedia({ video: true, audio: true, quality: '720p' })).rejects.toThrow(
      'Unknown error'
    );
  });

  test('video: false のとき getUserMedia を呼ばない', async () => {
    await expect(
      captureUserMedia({ video: false, audio: false, quality: '720p' })
    ).rejects.toThrow();

    expect(mockGetUserMedia).not.toHaveBeenCalled();
  });
});

/**
 * PR007 統合テスト: 画面共有取得 (getDisplayMedia)
 * 対象: src/frontend/src/lib/captureDisplayMedia.ts
 */

import { captureDisplayMedia } from '../../src/frontend/src/lib/captureDisplayMedia';

const mockGetDisplayMedia = jest.fn();
const mockMediaRecorder = jest.fn(() => ({}));

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

describe('[PR007] captureDisplayMedia ブラウザ互換性', () => {
  test('getDisplayMedia 未対応ブラウザで NotSupportedError を投げる', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: {},
      configurable: true,
      writable: true,
    });

    const result = await captureDisplayMedia().catch((e: Error) => e);
    expect((result as Error).name).toBe('NotSupportedError');
  });

  test('mediaDevices が null の場合も NotSupportedError を投げる', async () => {
    Object.defineProperty(global.navigator, 'mediaDevices', {
      value: null,
      configurable: true,
      writable: true,
    });

    const result = await captureDisplayMedia().catch((e: Error) => e);
    expect((result as Error).name).toBe('NotSupportedError');
  });
});

describe('[PR007] captureDisplayMedia エラーハンドリング', () => {
  test('PermissionDeniedError が正しい name で投げられる', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    mockGetDisplayMedia.mockRejectedValue(err);

    const result = await captureDisplayMedia().catch((e: Error) => e);
    expect((result as Error).name).toBe('PermissionDeniedError');
  });

  test('キャンセル時（NotAllowedError）も PermissionDeniedError に変換される', async () => {
    const err = Object.assign(new Error('cancelled'), { name: 'NotAllowedError' });
    mockGetDisplayMedia.mockRejectedValue(err);

    const result = await captureDisplayMedia().catch((e: Error) => e);
    expect((result as Error).name).toBe('PermissionDeniedError');
  });
});

describe('[PR007] captureDisplayMedia 正常系', () => {
  test('video: true で getDisplayMedia が呼ばれる', async () => {
    const mockStream = { getTracks: jest.fn(() => []) } as unknown as MediaStream;
    mockGetDisplayMedia.mockResolvedValue(mockStream);

    await captureDisplayMedia();

    expect(mockGetDisplayMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: true })
    );
  });
});

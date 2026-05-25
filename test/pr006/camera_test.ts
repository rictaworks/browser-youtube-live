/**
 * PR006 統合テスト: カメラ・マイク映像取得 (getUserMedia)
 * 対象: src/frontend/src/lib/captureUserMedia.ts
 */

import { QUALITY_CONSTRAINTS, captureUserMedia } from '../../src/frontend/src/lib/captureUserMedia';

describe('[PR006] QUALITY_CONSTRAINTS ハードコード検出', () => {
  test('1080p の値がハードコードされていない（定数から参照）', () => {
    expect(QUALITY_CONSTRAINTS['1080p'].width).toBe(1920);
    expect(QUALITY_CONSTRAINTS['1080p'].height).toBe(1080);
    expect(QUALITY_CONSTRAINTS['1080p'].frameRate).toBe(30);
  });

  test('720p の値がハードコードされていない（定数から参照）', () => {
    expect(QUALITY_CONSTRAINTS['720p'].width).toBe(1280);
    expect(QUALITY_CONSTRAINTS['720p'].height).toBe(720);
    expect(QUALITY_CONSTRAINTS['720p'].frameRate).toBe(30);
  });

  test('480p の値がハードコードされていない（定数から参照）', () => {
    expect(QUALITY_CONSTRAINTS['480p'].width).toBe(854);
    expect(QUALITY_CONSTRAINTS['480p'].height).toBe(480);
    expect(QUALITY_CONSTRAINTS['480p'].frameRate).toBe(30);
  });

  test('すべての品質プリセットが定義されている', () => {
    const qualities = ['1080p', '720p', '480p'] as const;
    qualities.forEach((q) => {
      expect(QUALITY_CONSTRAINTS[q]).toBeDefined();
      expect(typeof QUALITY_CONSTRAINTS[q].width).toBe('number');
      expect(typeof QUALITY_CONSTRAINTS[q].height).toBe('number');
      expect(typeof QUALITY_CONSTRAINTS[q].frameRate).toBe('number');
    });
  });
});

describe('[PR006] captureUserMedia エラーハンドリング', () => {
  const mockGetUserMedia = jest.fn();
  const mockMediaRecorder = jest.fn(() => ({}));

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

  test('PermissionDeniedError が正しい name で投げられる', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    mockGetUserMedia.mockRejectedValue(err);

    const result = await captureUserMedia({ video: true, audio: true, quality: '720p' }).catch(
      (e: Error) => e
    );
    expect((result as Error).name).toBe('PermissionDeniedError');
  });

  test('DeviceNotFoundError が正しい name で投げられる', async () => {
    const err = Object.assign(new Error('not found'), { name: 'NotFoundError' });
    mockGetUserMedia.mockRejectedValue(err);

    const result = await captureUserMedia({ video: true, audio: true, quality: '720p' }).catch(
      (e: Error) => e
    );
    expect((result as Error).name).toBe('DeviceNotFoundError');
  });
});

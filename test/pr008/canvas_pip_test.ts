/**
 * @jest-environment jsdom
 */
/**
 * PR008 統合テスト: Canvas PiP 合成
 * 対象: src/frontend/src/lib/canvasMixer.ts
 */

import {
  computePipRect,
  drawFrame,
  startCanvasMix,
  DEFAULT_PIP_LAYOUT,
  PipLayout,
} from '../../src/frontend/src/lib/canvasMixer';

// --- ハードコード検出 ---

describe('[PR008] DEFAULT_PIP_LAYOUT ハードコード検出', () => {
  test('scale が定数から参照されている', () => {
    expect(DEFAULT_PIP_LAYOUT.scale).toBe(0.25);
  });

  test('marginX が定数から参照されている', () => {
    expect(DEFAULT_PIP_LAYOUT.marginX).toBe(16);
  });

  test('marginY が定数から参照されている', () => {
    expect(DEFAULT_PIP_LAYOUT.marginY).toBe(16);
  });
});

// --- computePipRect ---

describe('[PR008] computePipRect PiP 矩形計算', () => {
  test('720p キャンバスで PiP が右下に配置される', () => {
    const rect = computePipRect(1280, 720, DEFAULT_PIP_LAYOUT);

    expect(rect.w).toBe(Math.round(1280 * DEFAULT_PIP_LAYOUT.scale));
    expect(rect.h).toBe(Math.round(720 * DEFAULT_PIP_LAYOUT.scale));
    expect(rect.x).toBe(1280 - rect.w - DEFAULT_PIP_LAYOUT.marginX);
    expect(rect.y).toBe(720 - rect.h - DEFAULT_PIP_LAYOUT.marginY);
  });

  test('1080p キャンバスで PiP 幅が canvas 幅の 25% になる', () => {
    const rect = computePipRect(1920, 1080, DEFAULT_PIP_LAYOUT);
    expect(rect.w).toBe(Math.round(1920 * 0.25));
  });

  test('カスタム scale が反映される', () => {
    const layout: PipLayout = { scale: 0.5, marginX: 10, marginY: 10 };
    const rect = computePipRect(1000, 600, layout);
    expect(rect.w).toBe(500);
    expect(rect.h).toBe(300);
  });

  test('margin が PiP 位置に反映される', () => {
    const layout: PipLayout = { scale: 0.25, marginX: 32, marginY: 24 };
    const rect = computePipRect(1280, 720, layout);
    expect(rect.x).toBe(1280 - rect.w - 32);
    expect(rect.y).toBe(720 - rect.h - 24);
  });
});

// --- drawFrame ---

describe('[PR008] drawFrame 描画ロジック', () => {
  const mockCtx = {
    drawImage: jest.fn(),
  } as unknown as CanvasRenderingContext2D;

  const mockScreenVideo = {} as HTMLVideoElement;
  const mockCameraVideo = {} as HTMLVideoElement;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('画面共有をキャンバス全体に描画する', () => {
    drawFrame(mockCtx, mockScreenVideo, null, 1280, 720, DEFAULT_PIP_LAYOUT);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockScreenVideo, 0, 0, 1280, 720);
  });

  test('カメラ null のとき PiP 描画はスキップされる', () => {
    drawFrame(mockCtx, mockScreenVideo, null, 1280, 720, DEFAULT_PIP_LAYOUT);
    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
  });

  test('カメラあるとき PiP 位置に描画される', () => {
    drawFrame(mockCtx, mockScreenVideo, mockCameraVideo, 1280, 720, DEFAULT_PIP_LAYOUT);
    const { x, y, w, h } = computePipRect(1280, 720, DEFAULT_PIP_LAYOUT);
    expect(mockCtx.drawImage).toHaveBeenNthCalledWith(2, mockCameraVideo, x, y, w, h);
  });
});

// --- startCanvasMix ---

describe('[PR008] startCanvasMix Canvas API 統合', () => {
  const mockTrack = { stop: jest.fn() };
  const mockMixedStream = { getTracks: jest.fn(() => [mockTrack]) } as unknown as MediaStream;
  const mockCaptureStream = jest.fn(() => mockMixedStream);
  const mockGetContext = jest.fn(() => ({
    drawImage: jest.fn(),
  }));
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: mockGetContext,
    captureStream: mockCaptureStream,
  };
  const mockCreateElement = jest.fn((tag: string) => {
    if (tag === 'canvas') return mockCanvas;
    return { srcObject: null, muted: false, play: jest.fn().mockResolvedValue(undefined) };
  });

  const mockScreenStream = {} as MediaStream;
  const mockCameraStream = {} as MediaStream;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(document, 'createElement').mockImplementation(mockCreateElement as typeof document.createElement);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).requestAnimationFrame = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('canvas の幅・高さが設定される', () => {
    startCanvasMix({ screenStream: mockScreenStream, cameraStream: mockCameraStream, width: 1280, height: 720 });
    expect(mockCanvas.width).toBe(1280);
    expect(mockCanvas.height).toBe(720);
  });

  test('captureStream(30) が呼ばれる', () => {
    startCanvasMix({ screenStream: mockScreenStream, cameraStream: mockCameraStream, width: 1280, height: 720 });
    expect(mockCaptureStream).toHaveBeenCalledWith(30);
  });

  test('stream と stop 関数を返す', () => {
    const result = startCanvasMix({ screenStream: mockScreenStream, cameraStream: mockCameraStream, width: 1280, height: 720 });
    expect(result.stream).toBe(mockMixedStream);
    expect(typeof result.stop).toBe('function');
  });

  test('stop() を呼ぶと cancelAnimationFrame が実行される', () => {
    const result = startCanvasMix({ screenStream: mockScreenStream, cameraStream: mockCameraStream, width: 1280, height: 720 });
    result.stop();
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });

  test('stop() を呼ぶと stream のトラックが停止される', () => {
    const result = startCanvasMix({ screenStream: mockScreenStream, cameraStream: mockCameraStream, width: 1280, height: 720 });
    result.stop();
    expect(mockTrack.stop).toHaveBeenCalled();
  });
});

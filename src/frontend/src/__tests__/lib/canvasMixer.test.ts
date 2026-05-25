import { computePipRect, drawFrame, DEFAULT_PIP_LAYOUT, PipLayout } from '@/lib/canvasMixer';

// --- computePipRect ---

describe('computePipRect', () => {
  test('デフォルトレイアウトで右下に配置される', () => {
    const rect = computePipRect(1280, 720, DEFAULT_PIP_LAYOUT);

    expect(rect.w).toBe(Math.round(1280 * DEFAULT_PIP_LAYOUT.scale));
    expect(rect.h).toBe(Math.round(720 * DEFAULT_PIP_LAYOUT.scale));
    expect(rect.x).toBe(1280 - rect.w - DEFAULT_PIP_LAYOUT.marginX);
    expect(rect.y).toBe(720 - rect.h - DEFAULT_PIP_LAYOUT.marginY);
  });

  test('scale=0.25 で幅の25%になる', () => {
    const layout: PipLayout = { scale: 0.25, marginX: 16, marginY: 16 };
    const rect = computePipRect(1280, 720, layout);

    expect(rect.w).toBe(320);
  });

  test('scale=0.5 で幅の50%になる', () => {
    const layout: PipLayout = { scale: 0.5, marginX: 0, marginY: 0 };
    const rect = computePipRect(1000, 500, layout);

    expect(rect.w).toBe(500);
    expect(rect.h).toBe(250);
  });

  test('margin が PiP 位置に反映される', () => {
    const layout: PipLayout = { scale: 0.25, marginX: 20, marginY: 30 };
    const rect = computePipRect(1280, 720, layout);

    expect(rect.x).toBe(1280 - rect.w - 20);
    expect(rect.y).toBe(720 - rect.h - 30);
  });
});

// --- drawFrame ---

describe('drawFrame', () => {
  const mockCtx = {
    drawImage: jest.fn(),
    clearRect: jest.fn(),
  } as unknown as CanvasRenderingContext2D;

  const mockScreenVideo = {} as HTMLVideoElement;
  const mockCameraVideo = {} as HTMLVideoElement;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('画面共有をフルサイズで描画する', () => {
    drawFrame(mockCtx, mockScreenVideo, null, 1280, 720, DEFAULT_PIP_LAYOUT);

    expect(mockCtx.drawImage).toHaveBeenCalledWith(mockScreenVideo, 0, 0, 1280, 720);
  });

  test('カメラが null のとき drawImage は1回だけ呼ばれる', () => {
    drawFrame(mockCtx, mockScreenVideo, null, 1280, 720, DEFAULT_PIP_LAYOUT);

    expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
  });

  test('カメラがあるとき drawImage は2回呼ばれる', () => {
    drawFrame(mockCtx, mockScreenVideo, mockCameraVideo, 1280, 720, DEFAULT_PIP_LAYOUT);

    expect(mockCtx.drawImage).toHaveBeenCalledTimes(2);
  });

  test('カメラを PiP 位置に描画する', () => {
    drawFrame(mockCtx, mockScreenVideo, mockCameraVideo, 1280, 720, DEFAULT_PIP_LAYOUT);

    const { x, y, w, h } = computePipRect(1280, 720, DEFAULT_PIP_LAYOUT);
    expect(mockCtx.drawImage).toHaveBeenNthCalledWith(2, mockCameraVideo, x, y, w, h);
  });
});

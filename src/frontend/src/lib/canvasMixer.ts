export interface PipLayout {
  scale: number;    // PiP の幅 = canvas幅 × scale
  marginX: number;
  marginY: number;
}

export const DEFAULT_PIP_LAYOUT: PipLayout = {
  scale: 0.25,
  marginX: 16,
  marginY: 16,
};

export interface MixConfig {
  screenStream: MediaStream;
  cameraStream: MediaStream;
  width: number;
  height: number;
  pip?: Partial<PipLayout>;
}

export interface MixResult {
  stream: MediaStream;
  stop: () => void;
}

export function computePipRect(
  canvasWidth: number,
  canvasHeight: number,
  layout: PipLayout
): { x: number; y: number; w: number; h: number } {
  const w = Math.round(canvasWidth * layout.scale);
  const h = Math.round(canvasHeight * layout.scale);
  return {
    x: canvasWidth - w - layout.marginX,
    y: canvasHeight - h - layout.marginY,
    w,
    h,
  };
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  screenVideo: HTMLVideoElement,
  cameraVideo: HTMLVideoElement | null,
  canvasWidth: number,
  canvasHeight: number,
  layout: PipLayout
): void {
  ctx.drawImage(screenVideo, 0, 0, canvasWidth, canvasHeight);

  if (cameraVideo) {
    const { x, y, w, h } = computePipRect(canvasWidth, canvasHeight, layout);
    ctx.drawImage(cameraVideo, x, y, w, h);
  }
}

function createVideoElement(stream: MediaStream): HTMLVideoElement {
  const video = document.createElement('video');
  video.srcObject = stream;
  video.muted = true;
  video.play().catch(() => {});
  return video;
}

export function startCanvasMix(config: MixConfig): MixResult {
  const { screenStream, cameraStream, width, height, pip } = config;
  const layout: PipLayout = { ...DEFAULT_PIP_LAYOUT, ...pip };

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context を取得できませんでした');

  const screenVideo = createVideoElement(screenStream);
  const cameraVideo = createVideoElement(cameraStream);

  let rafId: number;

  const loop = () => {
    drawFrame(ctx, screenVideo, cameraVideo, width, height, layout);
    rafId = requestAnimationFrame(loop);
  };
  rafId = requestAnimationFrame(loop);

  const stream = canvas.captureStream(30);

  const stop = () => {
    cancelAnimationFrame(rafId);
    screenVideo.srcObject = null;
    cameraVideo.srcObject = null;
    stream.getTracks().forEach((t) => t.stop());
  };

  return { stream, stop };
}

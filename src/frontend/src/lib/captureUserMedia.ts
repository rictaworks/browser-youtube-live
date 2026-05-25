export type Quality = '1080p' | '720p' | '480p';

export interface CaptureConfig {
  video: boolean;
  audio: boolean;
  quality: Quality;
}

export interface CaptureResult {
  stream: MediaStream;
  recorder: MediaRecorder;
}

export const QUALITY_CONSTRAINTS: Record<Quality, { width: number; height: number; frameRate: number }> = {
  '1080p': { width: 1920, height: 1080, frameRate: 30 },
  '720p':  { width: 1280, height: 720,  frameRate: 30 },
  '480p':  { width: 854,  height: 480,  frameRate: 30 },
};

const MIME_TYPE = 'video/webm;codecs=vp8,opus';

export async function captureUserMedia(config: CaptureConfig): Promise<CaptureResult> {
  if (!config.video) {
    throw new Error('video: true が必要です');
  }

  const videoConstraints = QUALITY_CONSTRAINTS[config.quality];

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: videoConstraints,
      audio: config.audio,
    });
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw Object.assign(new Error('PermissionDeniedError'), { name: 'PermissionDeniedError' });
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        throw Object.assign(new Error('DeviceNotFoundError'), { name: 'DeviceNotFoundError' });
      }
    }
    throw err;
  }

  const recorder = new MediaRecorder(stream, { mimeType: MIME_TYPE });

  return { stream, recorder };
}

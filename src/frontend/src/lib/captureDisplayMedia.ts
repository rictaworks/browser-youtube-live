import { WEBM_MIME_TYPE } from '@/lib/mediaConstants';

export interface DisplayCaptureResult {
  stream: MediaStream;
  recorder: MediaRecorder;
}

export async function captureDisplayMedia(): Promise<DisplayCaptureResult> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw Object.assign(new Error('NotSupportedError'), { name: 'NotSupportedError' });
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  } catch (err) {
    if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
      throw Object.assign(new Error('PermissionDeniedError'), { name: 'PermissionDeniedError' });
    }
    throw err;
  }

  const recorder = new MediaRecorder(stream, { mimeType: WEBM_MIME_TYPE });

  return { stream, recorder };
}

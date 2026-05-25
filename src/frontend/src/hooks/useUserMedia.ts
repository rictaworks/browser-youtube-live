import { useState, useCallback } from 'react';
import { captureUserMedia, CaptureConfig } from '@/lib/captureUserMedia';
import { stopMediaTracks } from '@/lib/mediaUtils';

export type UserMediaState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'capturing'; stream: MediaStream; recorder: MediaRecorder }
  | { status: 'error'; error: Error };

export async function startCapture(config: CaptureConfig): Promise<UserMediaState> {
  try {
    const { stream, recorder } = await captureUserMedia(config);
    return { status: 'capturing', stream, recorder };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export function stopCapture(state: UserMediaState): UserMediaState {
  return stopMediaTracks(state);
}

export function useUserMedia() {
  const [state, setState] = useState<UserMediaState>({ status: 'idle' });

  const start = useCallback(async (config: CaptureConfig) => {
    setState({ status: 'loading' });
    const next = await startCapture(config);
    setState(next);
  }, []);

  const stop = useCallback(() => {
    setState((prev) => stopCapture(prev));
  }, []);

  return { state, start, stop };
}

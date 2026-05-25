import { useState, useCallback } from 'react';
import { captureDisplayMedia } from '@/lib/captureDisplayMedia';
import { stopMediaTracks } from '@/lib/mediaUtils';

export type DisplayMediaState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'capturing'; stream: MediaStream; recorder: MediaRecorder }
  | { status: 'error'; error: Error };

export async function startScreenCapture(): Promise<DisplayMediaState> {
  try {
    const { stream, recorder } = await captureDisplayMedia();
    return { status: 'capturing', stream, recorder };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export function stopScreenCapture(state: DisplayMediaState): DisplayMediaState {
  return stopMediaTracks(state);
}

export function useDisplayMedia() {
  const [state, setState] = useState<DisplayMediaState>({ status: 'idle' });

  const start = useCallback(async () => {
    setState({ status: 'loading' });
    const next = await startScreenCapture();
    setState(next);
  }, []);

  const stop = useCallback(() => {
    setState((prev) => stopScreenCapture(prev));
  }, []);

  return { state, start, stop };
}

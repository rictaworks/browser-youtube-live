import { useState, useCallback } from 'react';
import { startCanvasMix, PipLayout } from '@/lib/canvasMixer';
import { QUALITY_CONSTRAINTS, Quality } from '@/lib/captureUserMedia';

export type CanvasMixerState =
  | { status: 'idle' }
  | { status: 'mixing'; mixedStream: MediaStream; stopMixing: () => void };

export function startMix(
  state: CanvasMixerState,
  screenStream: MediaStream,
  cameraStream: MediaStream,
  quality: Quality = '720p',
  pip?: Partial<PipLayout>
): CanvasMixerState {
  if (state.status === 'mixing') {
    state.stopMixing();
  }

  const { width, height } = QUALITY_CONSTRAINTS[quality];
  const { stream, stop } = startCanvasMix({
    screenStream,
    cameraStream,
    width,
    height,
    pip,
  });

  return { status: 'mixing', mixedStream: stream, stopMixing: stop };
}

export function stopMix(state: CanvasMixerState): CanvasMixerState {
  if (state.status !== 'mixing') return { status: 'idle' };
  state.stopMixing();
  return { status: 'idle' };
}

export function useCanvasMixer() {
  const [state, setState] = useState<CanvasMixerState>({ status: 'idle' });

  const start = useCallback(
    (screenStream: MediaStream, cameraStream: MediaStream, quality: Quality = '720p') => {
      setState((prev) => startMix(prev, screenStream, cameraStream, quality));
    },
    []
  );

  const stop = useCallback(() => {
    setState((prev) => stopMix(prev));
  }, []);

  return { state, start, stop };
}

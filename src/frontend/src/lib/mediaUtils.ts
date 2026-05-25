type CapturingState = { status: 'capturing'; stream: MediaStream; recorder: MediaRecorder };
type IdleState = { status: 'idle' };
type StoppableState = CapturingState | IdleState | { status: string };

export function stopMediaTracks(state: StoppableState): IdleState {
  if (state.status === 'capturing') {
    (state as CapturingState).stream.getTracks().forEach((track) => track.stop());
  }
  return { status: 'idle' };
}

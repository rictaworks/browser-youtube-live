import {
  createStreamSession,
  registerBridgeSession,
  endStreamSession,
  terminateBridgeSession,
  recoverStreamSession,
} from '@/lib/streamSession';
import { config } from '@/lib/env';

export type StreamSessionState =
  | { phase: 'IDLE' }
  | { phase: 'CREATING' }
  | { phase: 'CONNECTING' }
  | { phase: 'STREAMING'; ws: WebSocket; recorder: MediaRecorder; sessionId: string }
  | { phase: 'RECONNECTING'; sessionId: string; attempt: number }
  | { phase: 'ENDING' }
  | { phase: 'COMPLETED' }
  | { phase: 'ERROR'; error: string };

export const IDLE: StreamSessionState = { phase: 'IDLE' };
export const MAX_RECONNECT_ATTEMPTS = 3;

const MIME_TYPE = 'video/webm;codecs=vp8,opus';
const RECONNECT_DELAY_MS = [2000, 4000, 8000];

export async function startStream(
  stream: MediaStream,
  quality: string,
  onStateChange: (state: StreamSessionState) => void
): Promise<StreamSessionState> {
  onStateChange({ phase: 'CREATING' });

  let session: Awaited<ReturnType<typeof createStreamSession>>;
  try {
    session = await createStreamSession(quality);
  } catch (err) {
    const error = err instanceof Error ? err.message : '配信セッション作成に失敗しました';
    const next: StreamSessionState = { phase: 'ERROR', error };
    onStateChange(next);
    return next;
  }

  onStateChange({ phase: 'CONNECTING' });

  try {
    await registerBridgeSession(session.id, session.rtmp_url);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'ブリッジ登録に失敗しました';
    const next: StreamSessionState = { phase: 'ERROR', error };
    onStateChange(next);
    return next;
  }

  return new Promise<StreamSessionState>((resolve) => {
    const ws = new WebSocket(`${config.bridgeWsUrl}/ws?session_id=${session.id}`);
    let resolved = false;
    let activeRecorder: MediaRecorder | null = null;

    ws.onclose = (event: CloseEvent) => {
      if (!resolved) return;
      if (event.wasClean) return;
      if (activeRecorder && activeRecorder.state !== 'inactive') {
        activeRecorder.stop();
      }
      onStateChange({ phase: 'RECONNECTING', sessionId: session.id, attempt: 1 });
    };

    ws.onopen = () => {
      const mimeType = MediaRecorder.isTypeSupported(MIME_TYPE) ? MIME_TYPE : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      activeRecorder = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      recorder.start(100);

      const next: StreamSessionState = { phase: 'STREAMING', ws, recorder, sessionId: session.id };
      resolved = true;
      onStateChange(next);
      resolve(next);
    };

    ws.onerror = () => {
      if (resolved) return;
      const next: StreamSessionState = {
        phase: 'ERROR',
        error: 'WebSocket 接続エラーが発生しました',
      };
      onStateChange(next);
      resolve(next);
    };
  });
}

export async function recoverAndReconnectStream(
  stream: MediaStream,
  sessionId: string,
  attempt: number,
  onStateChange: (state: StreamSessionState) => void
): Promise<StreamSessionState> {
  const delay = RECONNECT_DELAY_MS[Math.min(attempt - 1, RECONNECT_DELAY_MS.length - 1)];
  await new Promise<void>((resolve) => setTimeout(resolve, delay));

  let recovered: Awaited<ReturnType<typeof recoverStreamSession>>;
  try {
    recovered = await recoverStreamSession(sessionId);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'セッション回復に失敗しました';
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      const next: StreamSessionState = { phase: 'ERROR', error };
      onStateChange(next);
      return next;
    }
    const next: StreamSessionState = { phase: 'RECONNECTING', sessionId, attempt: attempt + 1 };
    onStateChange(next);
    return next;
  }

  const { session_id: newSessionId, rtmp_url } = recovered;

  try {
    await registerBridgeSession(newSessionId, rtmp_url);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'ブリッジ再登録に失敗しました';
    if (attempt >= MAX_RECONNECT_ATTEMPTS) {
      const next: StreamSessionState = { phase: 'ERROR', error };
      onStateChange(next);
      return next;
    }
    const next: StreamSessionState = {
      phase: 'RECONNECTING',
      sessionId: newSessionId,
      attempt: attempt + 1,
    };
    onStateChange(next);
    return next;
  }

  return new Promise<StreamSessionState>((resolve) => {
    const ws = new WebSocket(`${config.bridgeWsUrl}/ws?session_id=${newSessionId}`);
    let resolved = false;
    let activeRecorder: MediaRecorder | null = null;

    ws.onopen = () => {
      const mimeType = MediaRecorder.isTypeSupported(MIME_TYPE) ? MIME_TYPE : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      activeRecorder = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      recorder.start(100);

      ws.onclose = (event: CloseEvent) => {
        if (!event.wasClean) {
          if (activeRecorder && activeRecorder.state !== 'inactive') {
            activeRecorder.stop();
          }
          const nextAttempt = attempt + 1;
          if (nextAttempt > MAX_RECONNECT_ATTEMPTS) {
            onStateChange({ phase: 'ERROR', error: '再接続の最大試行回数に達しました' });
          } else {
            onStateChange({
              phase: 'RECONNECTING',
              sessionId: newSessionId,
              attempt: nextAttempt,
            });
          }
        }
      };

      const next: StreamSessionState = {
        phase: 'STREAMING',
        ws,
        recorder,
        sessionId: newSessionId,
      };
      resolved = true;
      onStateChange(next);
      resolve(next);
    };

    ws.onerror = () => {
      if (resolved) return;
      const error = 'WebSocket 接続エラーが発生しました';
      if (attempt >= MAX_RECONNECT_ATTEMPTS) {
        const next: StreamSessionState = { phase: 'ERROR', error };
        onStateChange(next);
        resolve(next);
      } else {
        const next: StreamSessionState = {
          phase: 'RECONNECTING',
          sessionId: newSessionId,
          attempt: attempt + 1,
        };
        onStateChange(next);
        resolve(next);
      }
    };
  });
}

export async function stopStream(
  ws: WebSocket | null,
  recorder: MediaRecorder | null,
  sessionId: string | null,
  onStateChange: (state: StreamSessionState) => void
): Promise<StreamSessionState> {
  onStateChange({ phase: 'ENDING' });

  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
  if (ws) {
    ws.close();
  }

  if (sessionId) {
    const results = await Promise.allSettled([
      endStreamSession(sessionId),
      terminateBridgeSession(sessionId),
    ]);
    results.forEach((r) => {
      if (r.status === 'rejected') {
        console.error('[stopStream] teardown error:', r.reason);
      }
    });
  }

  const next: StreamSessionState = { phase: 'COMPLETED' };
  onStateChange(next);
  return next;
}

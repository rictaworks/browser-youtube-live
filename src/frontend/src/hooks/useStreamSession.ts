import {
  createStreamSession,
  registerBridgeSession,
  endStreamSession,
  terminateBridgeSession,
} from '@/lib/streamSession';
import { config } from '@/lib/env';

export type StreamSessionState =
  | { phase: 'IDLE' }
  | { phase: 'CREATING' }
  | { phase: 'CONNECTING' }
  | { phase: 'STREAMING'; ws: WebSocket; recorder: MediaRecorder; sessionId: string }
  | { phase: 'ENDING' }
  | { phase: 'COMPLETED' }
  | { phase: 'ERROR'; error: string };

export const IDLE: StreamSessionState = { phase: 'IDLE' };

const MIME_TYPE = 'video/webm;codecs=vp8,opus';

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

    ws.onopen = () => {
      const mimeType = MediaRecorder.isTypeSupported(MIME_TYPE) ? MIME_TYPE : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      recorder.start(100);

      const next: StreamSessionState = { phase: 'STREAMING', ws, recorder, sessionId: session.id };
      onStateChange(next);
      resolve(next);
    };

    ws.onerror = () => {
      const next: StreamSessionState = {
        phase: 'ERROR',
        error: 'WebSocket 接続エラーが発生しました',
      };
      onStateChange(next);
      resolve(next);
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
    try {
      await Promise.allSettled([endStreamSession(sessionId), terminateBridgeSession(sessionId)]);
    } catch {
      // 終了処理のエラーは無視して COMPLETED へ遷移する
    }
  }

  const next: StreamSessionState = { phase: 'COMPLETED' };
  onStateChange(next);
  return next;
}

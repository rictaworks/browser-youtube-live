import { config } from '@/lib/env';

export type StreamSessionResponse = {
  id: string;
  broadcast_id: string;
  rtmp_url: string;
  status: string;
  quality: string;
  ended_at?: string | null;
};

export class StreamApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'StreamApiError';
  }
}

export async function createStreamSession(quality: string): Promise<StreamSessionResponse> {
  const res = await fetch(`${config.apiBaseUrl}/stream_sessions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quality }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new StreamApiError(data.error ?? 'セッション作成に失敗しました', data.code);
  }
  return data as StreamSessionResponse;
}

export async function endStreamSession(sessionId: string): Promise<StreamSessionResponse> {
  const res = await fetch(`${config.apiBaseUrl}/stream_sessions/${sessionId}/end`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) {
    throw new StreamApiError(data.error ?? '配信終了に失敗しました', data.code);
  }
  return data as StreamSessionResponse;
}

function bridgeHttpUrl(): string {
  return config.bridgeWsUrl.replace(/^ws:\/\//, 'http://').replace(/^wss:\/\//, 'https://');
}

export async function registerBridgeSession(sessionId: string, rtmpUrl: string): Promise<void> {
  const res = await fetch(`${bridgeHttpUrl()}/bridge/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, rtmp_url: rtmpUrl }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new StreamApiError(data.error ?? 'ブリッジ登録に失敗しました');
  }
}

export async function terminateBridgeSession(sessionId: string): Promise<void> {
  const res = await fetch(`${bridgeHttpUrl()}/bridge/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const data = await res.json();
    throw new StreamApiError(data.error ?? 'ブリッジ終了に失敗しました');
  }
}

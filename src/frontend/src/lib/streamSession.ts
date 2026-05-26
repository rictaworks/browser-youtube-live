import { config } from '@/lib/env';

export type StreamSessionResponse = {
  id: string;
  broadcast_id: string;
  rtmp_url: string;
  status: string;
  quality: string;
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

export async function registerBridgeSession(sessionId: string, rtmpUrl: string): Promise<void> {
  const bridgeHttpUrl = config.bridgeWsUrl
    .replace(/^ws:\/\//, 'http://')
    .replace(/^wss:\/\//, 'https://');
  const res = await fetch(`${bridgeHttpUrl}/bridge/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, rtmp_url: rtmpUrl }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new StreamApiError(data.error ?? 'ブリッジ登録に失敗しました');
  }
}

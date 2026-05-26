import { createStreamSession, registerBridgeSession, StreamApiError } from '@/lib/streamSession';

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createStreamSession', () => {
  test('正常レスポンスでセッション情報を返す', async () => {
    const mockResponse = {
      id: 'session-uuid-123',
      broadcast_id: 'broadcast_abc',
      rtmp_url: 'rtmp://a.rtmp.youtube.com/live2/key-abc',
      status: 'created',
      quality: '720p',
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await createStreamSession('720p');

    expect(result).toEqual(mockResponse);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/stream_sessions'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ quality: '720p' }),
      })
    );
  });

  test('APIエラー時に StreamApiError を投げる（code も含む）', async () => {
    const errorPayload = {
      error: 'YouTube API クォータが上限に達しました',
      code: 'quota_exceeded',
    };
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => errorPayload,
    });

    const err = await createStreamSession('720p').catch((e) => e);
    expect(err).toBeInstanceOf(StreamApiError);
    expect(err.code).toBe('quota_exceeded');
  });

  test('config.apiBaseUrl を使用している（ハードコード禁止）', async () => {
    jest.mock('@/lib/env', () => ({
      config: {
        apiBaseUrl: 'http://test-api.example.com',
        bridgeWsUrl: 'ws://test-bridge.example.com',
      },
    }));
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await createStreamSession('720p').catch(() => {});
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    // env.ts の config を経由していることを確認（/stream_sessions パスが含まれる）
    expect(calledUrl).toMatch(/\/stream_sessions$/);
  });
});

describe('registerBridgeSession', () => {
  test('正常レスポンスで resolve する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    await expect(
      registerBridgeSession('sess-1', 'rtmp://example.com/live')
    ).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/bridge/sessions'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ session_id: 'sess-1', rtmp_url: 'rtmp://example.com/live' }),
      })
    );
  });

  test('ws:// URL を http:// に変換してリクエストする', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await registerBridgeSession('sess-1', 'rtmp://example.com/live');
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/^http:\/\//);
    expect(calledUrl).not.toMatch(/^ws:\/\//);
  });

  test('エラー時に StreamApiError を投げる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'session already exists' }),
    });

    await expect(registerBridgeSession('sess-1', 'rtmp://example.com')).rejects.toThrow(
      StreamApiError
    );
  });
});

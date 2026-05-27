/**
 * PR009 統合テスト: 配信開始（YouTube Broadcast 作成・RTMP 配信）
 * 対象: src/frontend/src/lib/streamSession.ts
 *       src/frontend/src/hooks/useStreamSession.ts
 */

import {
  createStreamSession,
  registerBridgeSession,
  StreamApiError,
} from "../../src/frontend/src/lib/streamSession";
import {
  startStream,
  MAX_RECONNECT_ATTEMPTS,
  type StreamSessionState,
} from "../../src/frontend/src/hooks/useStreamSession";

// --- fetch モック ---
const mockFetch = jest.fn();
global.fetch = mockFetch;

// --- MediaRecorder モック ---
const mockRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  state: "inactive" as RecordingState,
  ondataavailable: null as ((e: BlobEvent) => void) | null,
};
const MockMediaRecorder = jest.fn(() => mockRecorder);
Object.assign(MockMediaRecorder, { isTypeSupported: jest.fn(() => true) });
Object.assign(global, { MediaRecorder: MockMediaRecorder });

// --- WebSocket モック ---
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  send = jest.fn();
  close = jest.fn();
  constructor(public url: string) {
    setTimeout(() => this.onopen?.(), 0);
  }
}
Object.assign(global, { WebSocket: MockWebSocket });

beforeEach(() => {
  jest.clearAllMocks();
  mockRecorder.state = "inactive";
});

// --- StreamApiError クラス ---

describe("[PR009] StreamApiError クラス", () => {
  test('name が "StreamApiError" である', () => {
    const err = new StreamApiError("失敗");
    expect(err.name).toBe("StreamApiError");
  });

  test("code プロパティを保持する", () => {
    const err = new StreamApiError("クォータ超過", "quota_exceeded");
    expect(err.code).toBe("quota_exceeded");
  });

  test("code なしでも構築できる", () => {
    const err = new StreamApiError("失敗");
    expect(err.code).toBeUndefined();
  });

  test("Error を継承している", () => {
    const err = new StreamApiError("失敗");
    expect(err).toBeInstanceOf(Error);
  });
});

// --- createStreamSession ハードコード検出 ---

describe("[PR009] createStreamSession ハードコード検出", () => {
  test("URL に /stream_sessions が含まれる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sess-1",
        broadcast_id: "bc-1",
        rtmp_url: "rtmp://example.com/live2/key",
        status: "created",
        quality: "720p",
      }),
    });
    await createStreamSession("720p");
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/\/stream_sessions$/);
  });

  test("quality が JSON ボディに含まれる（ハードコード禁止）", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "s",
        broadcast_id: "b",
        rtmp_url: "rtmp://x",
        status: "created",
        quality: "1080p",
      }),
    });
    await createStreamSession("1080p");
    const calledBody = mockFetch.mock.calls[0]?.[1]?.body as string;
    expect(JSON.parse(calledBody)).toEqual({ quality: "1080p" });
  });
});

// --- createStreamSession 正常系・異常系 ---

describe("[PR009] createStreamSession", () => {
  const successResponse = {
    id: "session-uuid-123",
    broadcast_id: "bc_abc",
    rtmp_url: "rtmp://a.rtmp.youtube.com/live2/key-abc",
    status: "created",
    quality: "720p",
  };

  test("正常レスポンスでセッション情報を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => successResponse,
    });
    const result = await createStreamSession("720p");
    expect(result).toEqual(successResponse);
  });

  test("POST メソッドと credentials:include で送信する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => successResponse,
    });
    await createStreamSession("720p");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  test("APIエラー時に StreamApiError を投げ code を保持する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "クォータ超過", code: "quota_exceeded" }),
    });
    const err = await createStreamSession("720p").catch((e) => e);
    expect(err).toBeInstanceOf(StreamApiError);
    expect((err as StreamApiError).code).toBe("quota_exceeded");
  });

  test("error フィールドなしの場合もデフォルトメッセージで StreamApiError を投げる", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    await expect(createStreamSession("720p")).rejects.toBeInstanceOf(
      StreamApiError,
    );
  });
});

// --- registerBridgeSession ---

describe("[PR009] registerBridgeSession ws→http URL 変換", () => {
  test("ws:// を http:// に変換してリクエストする", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await registerBridgeSession("sess-1", "rtmp://example.com/live");
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/^http:\/\//);
    expect(calledUrl).not.toMatch(/^ws:\/\//);
  });

  test("/bridge/sessions パスにリクエストする", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await registerBridgeSession("sess-1", "rtmp://example.com/live");
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/\/bridge\/sessions$/);
  });

  test("session_id と rtmp_url を JSON ボディに含める", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await registerBridgeSession("sess-abc", "rtmp://x.example.com/live2/key");
    const calledBody = mockFetch.mock.calls[0]?.[1]?.body as string;
    expect(JSON.parse(calledBody)).toEqual({
      session_id: "sess-abc",
      rtmp_url: "rtmp://x.example.com/live2/key",
    });
  });

  test("エラー時に StreamApiError を投げる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "already registered" }),
    });
    await expect(
      registerBridgeSession("sess-1", "rtmp://x"),
    ).rejects.toBeInstanceOf(StreamApiError);
  });
});

// --- startStream 状態遷移（fetch を通じた統合テスト）---

describe("[PR009] startStream 状態遷移", () => {
  const mockStream = { getTracks: jest.fn(() => []) } as unknown as MediaStream;

  function mockSessionFetch(): void {
    // createStreamSession の POST /stream_sessions
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sess-uuid-1",
        broadcast_id: "bc_abc",
        rtmp_url: "rtmp://a.rtmp.youtube.com/live2/key-abc",
        status: "created",
        quality: "720p",
        ended_at: null,
      }),
    });
    // registerBridgeSession の POST /bridge/sessions
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  }

  test("CREATING → CONNECTING → STREAMING の順に遷移する", async () => {
    mockSessionFetch();
    const states: string[] = [];
    const result = await startStream(mockStream, "720p", (s) =>
      states.push(s.phase),
    );
    expect(states[0]).toBe("CREATING");
    expect(states[1]).toBe("CONNECTING");
    expect(result.phase).toBe("STREAMING");
  });

  test("STREAMING 状態に sessionId が含まれる", async () => {
    mockSessionFetch();
    const result = await startStream(mockStream, "720p", () => {});
    if (result.phase === "STREAMING") {
      expect(result.sessionId).toBe("sess-uuid-1");
    } else {
      fail("phase は STREAMING のはず");
    }
  });

  test("createStreamSession 失敗時は ERROR 状態に遷移する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "API エラー" }),
    });
    const states: StreamSessionState[] = [];
    const result = await startStream(mockStream, "720p", (s) => states.push(s));
    expect(result.phase).toBe("ERROR");
  });

  test("registerBridgeSession 失敗時は ERROR 状態に遷移する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sess-uuid-1",
        broadcast_id: "bc_abc",
        rtmp_url: "rtmp://x",
        status: "created",
        quality: "720p",
        ended_at: null,
      }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "ブリッジエラー" }),
    });
    const result = await startStream(mockStream, "720p", () => {});
    expect(result.phase).toBe("ERROR");
  });
});

// --- MAX_RECONNECT_ATTEMPTS 定数 ---

describe("[PR009] MAX_RECONNECT_ATTEMPTS 定数", () => {
  test("MAX_RECONNECT_ATTEMPTS は 3 である", () => {
    expect(MAX_RECONNECT_ATTEMPTS).toBe(3);
  });
});

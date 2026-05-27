/**
 * PR014 統合テスト: セッション回復（切断時の自動再接続）
 * 対象: src/frontend/src/lib/streamSession.ts
 *       src/frontend/src/hooks/useStreamSession.ts
 */

import {
  recoverStreamSession,
  StreamApiError,
  type RecoverSessionResponse,
} from "../../src/frontend/src/lib/streamSession";
import {
  recoverAndReconnectStream,
  MAX_RECONNECT_ATTEMPTS,
  type StreamSessionState,
} from "../../src/frontend/src/hooks/useStreamSession";

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

// --- MAX_RECONNECT_ATTEMPTS 定数 ---

describe("[PR014] MAX_RECONNECT_ATTEMPTS 定数", () => {
  test("MAX_RECONNECT_ATTEMPTS は 3 である", () => {
    expect(MAX_RECONNECT_ATTEMPTS).toBe(3);
  });
});

// --- RecoverSessionResponse 型フィールド ---

describe("[PR014] RecoverSessionResponse 型フィールド", () => {
  const resp: RecoverSessionResponse = {
    recovered: true,
    session_id: "sess-new",
    rtmp_url: "rtmp://a.rtmp.youtube.com/live2/key",
    broadcast_id: "bc-123",
    new_broadcast: false,
  };

  test("recovered フィールドが boolean である", () => {
    expect(typeof resp.recovered).toBe("boolean");
  });

  test("session_id・rtmp_url・broadcast_id が string である", () => {
    expect(typeof resp.session_id).toBe("string");
    expect(typeof resp.rtmp_url).toBe("string");
    expect(typeof resp.broadcast_id).toBe("string");
  });

  test("new_broadcast フィールドが boolean である", () => {
    expect(typeof resp.new_broadcast).toBe("boolean");
  });
});

// --- recoverStreamSession ハードコード検出 ---

describe("[PR014] recoverStreamSession ハードコード検出", () => {
  test("URL に /stream_sessions/:id/recover が含まれる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        recovered: true,
        session_id: "sess-1",
        rtmp_url: "rtmp://x",
        broadcast_id: "bc-1",
        new_broadcast: false,
      }),
    });
    await recoverStreamSession("sess-abc");
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/\/stream_sessions\/sess-abc\/recover$/);
  });
});

// --- recoverStreamSession 正常系・異常系 ---

describe("[PR014] recoverStreamSession", () => {
  const successResponse: RecoverSessionResponse = {
    recovered: true,
    session_id: "sess-recovered",
    rtmp_url: "rtmp://a.rtmp.youtube.com/live2/key-new",
    broadcast_id: "bc-new",
    new_broadcast: false,
  };

  test("POST メソッドと credentials:include で送信する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => successResponse,
    });
    await recoverStreamSession("sess-1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  test("正常レスポンスで回復情報を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => successResponse,
    });
    const result = await recoverStreamSession("sess-1");
    expect(result).toEqual(successResponse);
    expect(result.recovered).toBe(true);
  });

  test("new_broadcast=true のとき新規ブロードキャスト作成を示す", async () => {
    const newBroadcastResp = { ...successResponse, new_broadcast: true };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => newBroadcastResp,
    });
    const result = await recoverStreamSession("sess-1");
    expect(result.new_broadcast).toBe(true);
  });

  test("APIエラー時に StreamApiError を投げ code を保持する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: "セッションが見つかりません",
        code: "not_found",
      }),
    });
    const err = await recoverStreamSession("sess-1").catch((e) => e);
    expect(err).toBeInstanceOf(StreamApiError);
    expect((err as StreamApiError).code).toBe("not_found");
  });
});

// --- StreamSessionState RECONNECTING フェーズ ---

describe("[PR014] StreamSessionState RECONNECTING フェーズ", () => {
  test("RECONNECTING 状態に sessionId と attempt が含まれる", () => {
    const state: StreamSessionState = {
      phase: "RECONNECTING",
      sessionId: "sess-abc",
      attempt: 2,
    };
    expect(state.phase).toBe("RECONNECTING");
    if (state.phase === "RECONNECTING") {
      expect(state.sessionId).toBe("sess-abc");
      expect(state.attempt).toBe(2);
    }
  });

  test("attempt が 1 〜 MAX_RECONNECT_ATTEMPTS の範囲である", () => {
    for (let i = 1; i <= MAX_RECONNECT_ATTEMPTS; i++) {
      const state: StreamSessionState = {
        phase: "RECONNECTING",
        sessionId: "sess-1",
        attempt: i,
      };
      if (state.phase === "RECONNECTING") {
        expect(state.attempt).toBeGreaterThanOrEqual(1);
        expect(state.attempt).toBeLessThanOrEqual(MAX_RECONNECT_ATTEMPTS);
      }
    }
  });

  test("recoverAndReconnectStream が関数としてエクスポートされている", () => {
    expect(typeof recoverAndReconnectStream).toBe("function");
  });
});

/**
 * PR010 統合テスト: 配信停止（安全なセッション終了・リソース解放）
 * 対象: src/frontend/src/lib/streamSession.ts
 *       src/frontend/src/hooks/useStreamSession.ts
 */

import {
  endStreamSession,
  terminateBridgeSession,
  StreamApiError,
} from "../../src/frontend/src/lib/streamSession";
import {
  stopStream,
  type StreamSessionState,
} from "../../src/frontend/src/hooks/useStreamSession";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

// --- endStreamSession ハードコード検出 ---

describe("[PR010] endStreamSession ハードコード検出", () => {
  test("URL に /stream_sessions/:id/end が含まれる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "sess-abc", status: "ended" }),
    });
    await endStreamSession("sess-abc");
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/\/stream_sessions\/sess-abc\/end$/);
  });
});

// --- endStreamSession 正常系・異常系 ---

describe("[PR010] endStreamSession", () => {
  test("PATCH メソッドと credentials:include で送信する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "sess-1", status: "ended" }),
    });
    await endStreamSession("sess-1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "PATCH", credentials: "include" }),
    );
  });

  test("正常レスポンスでセッション情報を返す", async () => {
    const response = {
      id: "sess-1",
      status: "ended",
      quality: "720p",
      broadcast_id: "bc-1",
      rtmp_url: "rtmp://x",
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => response });
    const result = await endStreamSession("sess-1");
    expect(result.status).toBe("ended");
  });

  test("APIエラー時に StreamApiError を投げる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "すでに終了しています" }),
    });
    await expect(endStreamSession("sess-1")).rejects.toBeInstanceOf(
      StreamApiError,
    );
  });
});

// --- terminateBridgeSession ハードコード検出 ---

describe("[PR010] terminateBridgeSession ハードコード検出", () => {
  test("URL に /bridge/sessions/:id が含まれる", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await terminateBridgeSession("sess-xyz");
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/\/bridge\/sessions\/sess-xyz$/);
  });
});

// --- terminateBridgeSession 正常系・異常系 ---

describe("[PR010] terminateBridgeSession", () => {
  test("DELETE メソッドで送信する", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await terminateBridgeSession("sess-1");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  test("ws:// URL を http:// に変換してリクエストする", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await terminateBridgeSession("sess-1");
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/^http:\/\//);
  });

  test("エラー時に StreamApiError を投げる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "not found" }),
    });
    await expect(terminateBridgeSession("sess-1")).rejects.toBeInstanceOf(
      StreamApiError,
    );
  });
});

// --- stopStream 状態遷移（fetch を通じた統合テスト）---

describe("[PR010] stopStream 状態遷移", () => {
  const mockWs = {
    close: jest.fn(),
    readyState: 1,
  } as unknown as WebSocket;

  const mockRecorder = {
    stop: jest.fn(),
    state: "recording" as RecordingState,
  } as unknown as MediaRecorder;

  function mockTeardownFetch(): void {
    // endStreamSession の PATCH /stream_sessions/:id/end
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "sess-1",
        status: "ended",
        quality: "720p",
        broadcast_id: "bc-1",
        rtmp_url: "rtmp://x",
      }),
    });
    // terminateBridgeSession の DELETE /bridge/sessions/:id
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockRecorder, { state: "recording" });
  });

  test("ENDING → COMPLETED の順に遷移する", async () => {
    mockTeardownFetch();
    const states: string[] = [];
    const result = await stopStream(mockWs, mockRecorder, "sess-1", (s) =>
      states.push(s.phase),
    );
    expect(states[0]).toBe("ENDING");
    expect(result.phase).toBe("COMPLETED");
  });

  test("recorder.stop() を呼ぶ（state が recording の場合）", async () => {
    mockTeardownFetch();
    await stopStream(mockWs, mockRecorder, "sess-1", () => {});
    expect(mockRecorder.stop).toHaveBeenCalled();
  });

  test("ws.close() を呼ぶ", async () => {
    mockTeardownFetch();
    await stopStream(mockWs, mockRecorder, "sess-1", () => {});
    expect(mockWs.close).toHaveBeenCalled();
  });

  test("recorder が inactive の場合は recorder.stop() を呼ばない", async () => {
    mockTeardownFetch();
    const inactiveRecorder = {
      stop: jest.fn(),
      state: "inactive" as RecordingState,
    } as unknown as MediaRecorder;
    await stopStream(mockWs, inactiveRecorder, "sess-1", () => {});
    expect(inactiveRecorder.stop).not.toHaveBeenCalled();
  });

  test("sessionId が null の場合も COMPLETED に遷移する", async () => {
    const result = await stopStream(null, null, null, () => {});
    expect(result.phase).toBe("COMPLETED");
  });

  test("endStreamSession と terminateBridgeSession が呼ばれる", async () => {
    mockTeardownFetch();
    await stopStream(mockWs, mockRecorder, "sess-1", () => {});
    const urls = mockFetch.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("/stream_sessions/sess-1/end"))).toBe(
      true,
    );
    expect(urls.some((u) => u.includes("/bridge/sessions/sess-1"))).toBe(true);
  });
});

// --- StreamSessionState フェーズ名確認 ---

describe("[PR010] StreamSessionState 停止フェーズ名", () => {
  test('停止中のフェーズ名は "ENDING" である', () => {
    const s: StreamSessionState = { phase: "ENDING" };
    expect(s.phase).toBe("ENDING");
  });

  test('完了フェーズ名は "COMPLETED" である', () => {
    const s: StreamSessionState = { phase: "COMPLETED" };
    expect(s.phase).toBe("COMPLETED");
  });
});

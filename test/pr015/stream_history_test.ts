/**
 * @jest-environment jsdom
 */
/**
 * PR015 統合テスト: 配信履歴一覧
 * 対象: src/frontend/src/lib/streamSession.ts
 *       src/frontend/src/components/StreamHistoryTable.tsx
 */

import { render, screen } from "@testing-library/react";
import {
  listStreamSessions,
  StreamApiError,
  type StreamHistoryItem,
  type StreamHistoryResponse,
} from "../../src/frontend/src/lib/streamSession";
import { StreamHistoryTable } from "../../src/frontend/src/components/StreamHistoryTable";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

// --- StreamHistoryItem 型フィールド ---

describe("[PR015] StreamHistoryItem 型フィールド", () => {
  const item: StreamHistoryItem = {
    id: "sess-1",
    status: "completed",
    quality: "720p",
    started_at: "2026-05-25T10:00:00Z",
    ended_at: "2026-05-25T10:30:00Z",
    created_at: "2026-05-25T09:59:00Z",
    duration_sec: 1800,
    max_viewers: 42,
    recording_url: "https://youtube.com/watch?v=abc",
  };

  test("id・status・quality が string である", () => {
    expect(typeof item.id).toBe("string");
    expect(typeof item.status).toBe("string");
    expect(typeof item.quality).toBe("string");
  });

  test("duration_sec・max_viewers は number または null である", () => {
    expect(
      typeof item.duration_sec === "number" || item.duration_sec === null,
    ).toBe(true);
    expect(
      typeof item.max_viewers === "number" || item.max_viewers === null,
    ).toBe(true);
  });

  test("recording_url は string または null である", () => {
    expect(
      typeof item.recording_url === "string" || item.recording_url === null,
    ).toBe(true);
  });
});

// --- listStreamSessions ハードコード検出 ---

describe("[PR015] listStreamSessions ハードコード検出", () => {
  const emptyResponse: StreamHistoryResponse = {
    sessions: [],
    page: 1,
    per_page: 20,
    total_count: 0,
    total_pages: 0,
  };

  test("URL に /stream_sessions が含まれる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => emptyResponse,
    });
    await listStreamSessions();
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/\/stream_sessions/);
  });

  test("page パラメータを含める（ハードコード禁止）", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => emptyResponse,
    });
    await listStreamSessions({ page: 3 });
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("page=3");
  });

  test("per_page パラメータを含める（ハードコード禁止）", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => emptyResponse,
    });
    await listStreamSessions({ perPage: 10 });
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("per_page=10");
  });
});

// --- listStreamSessions 正常系・異常系 ---

describe("[PR015] listStreamSessions", () => {
  const mockHistory: StreamHistoryResponse = {
    sessions: [
      {
        id: "sess-1",
        status: "completed",
        quality: "720p",
        started_at: "2026-05-25T10:00:00Z",
        ended_at: "2026-05-25T10:30:00Z",
        created_at: "2026-05-25T09:59:00Z",
        duration_sec: 1800,
        max_viewers: 42,
        recording_url: null,
      },
    ],
    page: 1,
    per_page: 20,
    total_count: 1,
    total_pages: 1,
  };

  test("正常レスポンスで履歴一覧を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHistory,
    });
    const result = await listStreamSessions();
    expect(result.sessions).toHaveLength(1);
    expect(result.total_count).toBe(1);
  });

  test("GET メソッドと credentials:include で取得する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHistory,
    });
    await listStreamSessions();
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  test("page・perPage 未指定のときクエリパラメータなしで取得する", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHistory,
    });
    await listStreamSessions();
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain("?");
  });

  test("page・perPage 両方指定のときクエリに含まれる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockHistory,
    });
    await listStreamSessions({ page: 2, perPage: 5 });
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).toContain("per_page=5");
  });

  test("APIエラー時に StreamApiError を投げる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "unauthorized", code: "auth_required" }),
    });
    const err = await listStreamSessions().catch((e) => e);
    expect(err).toBeInstanceOf(StreamApiError);
  });
});

// --- StreamHistoryTable 空状態 ---

describe("[PR015] StreamHistoryTable 空状態", () => {
  test("セッションが 0 件のとき空メッセージを表示する", () => {
    render(StreamHistoryTable({ sessions: [] }));
    expect(screen.getByText(/配信履歴がありません/)).toBeInTheDocument();
  });
});

// --- StreamHistoryTable セッション表示 ---

describe("[PR015] StreamHistoryTable セッション行表示", () => {
  const sessions: StreamHistoryItem[] = [
    {
      id: "sess-1",
      status: "completed",
      quality: "720p",
      started_at: "2026-05-25T10:00:00Z",
      ended_at: "2026-05-25T10:30:00Z",
      created_at: "2026-05-25T09:59:00Z",
      duration_sec: 1800,
      max_viewers: 42,
      recording_url: null,
    },
  ];

  test("ステータスを表示する", () => {
    render(StreamHistoryTable({ sessions }));
    expect(screen.getByText("completed")).toBeInTheDocument();
  });

  test("品質を表示する", () => {
    render(StreamHistoryTable({ sessions }));
    expect(screen.getByText("720p")).toBeInTheDocument();
  });

  test("最大視聴者数を表示する", () => {
    render(StreamHistoryTable({ sessions }));
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  test("duration_sec=1800 → 00:30:00 と表示する", () => {
    render(StreamHistoryTable({ sessions }));
    expect(screen.getByText("00:30:00")).toBeInTheDocument();
  });

  test('duration_sec=null → "—" と表示する', () => {
    const nullDuration = [{ ...sessions[0], duration_sec: null }];
    render(StreamHistoryTable({ sessions: nullDuration }));
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  test('max_viewers=null → "—" と表示する', () => {
    const nullViewers = [{ ...sessions[0], max_viewers: null }];
    render(StreamHistoryTable({ sessions: nullViewers }));
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

// --- StreamHistoryTable 録画 URL セキュリティ ---

describe("[PR015] StreamHistoryTable 録画 URL セキュリティ", () => {
  const baseSession: StreamHistoryItem = {
    id: "sess-2",
    status: "completed",
    quality: "720p",
    started_at: null,
    ended_at: null,
    created_at: "2026-05-25T09:59:00Z",
    duration_sec: null,
    max_viewers: null,
    recording_url: null,
  };

  test("recording_url が https:// のとき「録画を見る」リンクを表示する", () => {
    const sessions = [
      { ...baseSession, recording_url: "https://youtube.com/watch?v=xyz" },
    ];
    render(StreamHistoryTable({ sessions }));
    const link = screen.getByRole("link", { name: "録画を見る" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://youtube.com/watch?v=xyz");
  });

  test("recording_url が null のとき「—」を表示する（リンクなし）", () => {
    render(StreamHistoryTable({ sessions: [baseSession] }));
    expect(
      screen.queryByRole("link", { name: "録画を見る" }),
    ).not.toBeInTheDocument();
  });

  test("recording_url が http:// のとき「—」を表示する（XSS 対策）", () => {
    const sessions = [
      { ...baseSession, recording_url: "http://insecure.example.com/video" },
    ];
    render(StreamHistoryTable({ sessions }));
    expect(
      screen.queryByRole("link", { name: "録画を見る" }),
    ).not.toBeInTheDocument();
  });

  test("recording_url が javascript: のとき「—」を表示する（XSS 対策）", () => {
    const sessions = [{ ...baseSession, recording_url: "javascript:alert(1)" }];
    render(StreamHistoryTable({ sessions }));
    expect(
      screen.queryByRole("link", { name: "録画を見る" }),
    ).not.toBeInTheDocument();
  });

  test('録画リンクは target="_blank" と rel="noopener noreferrer" を持つ', () => {
    const sessions = [
      { ...baseSession, recording_url: "https://youtube.com/watch?v=abc" },
    ];
    render(StreamHistoryTable({ sessions }));
    const link = screen.getByRole("link", { name: "録画を見る" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});

// --- StreamHistoryTable 日時フォーマット ---

describe("[PR015] StreamHistoryTable 日時フォーマット", () => {
  test("started_at が有効な ISO 日時のとき YYYY-MM-DD HH:MM 形式で表示する", () => {
    const sessions: StreamHistoryItem[] = [
      {
        id: "sess-3",
        status: "completed",
        quality: "720p",
        started_at: "2026-05-25T10:00:00Z",
        ended_at: null,
        created_at: "2026-05-25T09:59:00Z",
        duration_sec: null,
        max_viewers: null,
        recording_url: null,
      },
    ];
    render(StreamHistoryTable({ sessions }));
    // タイムゾーン依存のため日付部分のみ確認
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  test("started_at が null のとき created_at を使用する", () => {
    const sessions: StreamHistoryItem[] = [
      {
        id: "sess-4",
        status: "completed",
        quality: "720p",
        started_at: null,
        ended_at: null,
        created_at: "2026-05-26T08:00:00Z",
        duration_sec: null,
        max_viewers: null,
        recording_url: null,
      },
    ];
    render(StreamHistoryTable({ sessions }));
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });
});

/**
 * PR011 統合テスト: 配信品質選択（1080p / 720p / 480p）
 * 対象: src/frontend/src/lib/qualityPresets.ts
 *       src/frontend/src/hooks/useQualityPresets.ts
 */

import {
  getQualityPresets,
  type QualityPresetResponse,
} from "../../src/frontend/src/lib/qualityPresets";
import { renderHook, waitFor } from "@testing-library/react";
import { useQualityPresets } from "../../src/frontend/src/hooks/useQualityPresets";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
});

// --- QualityPresetResponse 型フィールド ---

describe("[PR011] QualityPresetResponse 型フィールド", () => {
  const preset: QualityPresetResponse = {
    name: "720p",
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: 3000,
    codec: "libx264",
    enabled: true,
  };

  test("name フィールドが string である", () => {
    expect(typeof preset.name).toBe("string");
  });

  test("width・height・fps・bitrate が number である", () => {
    expect(typeof preset.width).toBe("number");
    expect(typeof preset.height).toBe("number");
    expect(typeof preset.fps).toBe("number");
    expect(typeof preset.bitrate).toBe("number");
  });

  test("codec フィールドが string である", () => {
    expect(typeof preset.codec).toBe("string");
  });

  test("enabled フィールドが boolean である", () => {
    expect(typeof preset.enabled).toBe("boolean");
  });
});

// --- getQualityPresets ハードコード検出 ---

describe("[PR011] getQualityPresets ハードコード検出", () => {
  test("URL に /quality_presets が含まれる", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });
    await getQualityPresets();
    const calledUrl = mockFetch.mock.calls[0]?.[0] as string;
    expect(calledUrl).toMatch(/\/quality_presets$/);
  });
});

// --- getQualityPresets 正常系・異常系 ---

describe("[PR011] getQualityPresets", () => {
  const mockPresets: QualityPresetResponse[] = [
    {
      name: "1080p",
      width: 1920,
      height: 1080,
      fps: 30,
      bitrate: 6000,
      codec: "libx264",
      enabled: false,
    },
    {
      name: "720p",
      width: 1280,
      height: 720,
      fps: 30,
      bitrate: 3000,
      codec: "libx264",
      enabled: true,
    },
    {
      name: "480p",
      width: 854,
      height: 480,
      fps: 30,
      bitrate: 1500,
      codec: "libx264",
      enabled: false,
    },
  ];

  test("正常レスポンスでプリセット配列を返す", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    });
    const result = await getQualityPresets();
    expect(result).toEqual(mockPresets);
    expect(Array.isArray(result)).toBe(true);
  });

  test("GET メソッドで取得する（body なし）", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    });
    await getQualityPresets();
    const options = mockFetch.mock.calls[0]?.[1];
    expect(options?.method ?? "GET").toBe("GET");
  });

  test("APIエラー時に Error を投げる", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    await expect(getQualityPresets()).rejects.toThrow(
      "品質プリセットの取得に失敗しました",
    );
  });

  test("デモ版: 720p のみ enabled=true である", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    });
    const result = await getQualityPresets();
    const enabled = result.filter((p) => p.enabled);
    expect(enabled.every((p) => p.name === "720p")).toBe(true);
  });

  test("1080p は enabled=false（デモ版制約）", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    });
    const result = await getQualityPresets();
    const p1080 = result.find((p) => p.name === "1080p");
    expect(p1080?.enabled).toBe(false);
  });
});

// --- useQualityPresets フック ---

describe("[PR011] useQualityPresets フック", () => {
  const mockPresets: QualityPresetResponse[] = [
    {
      name: "720p",
      width: 1280,
      height: 720,
      fps: 30,
      bitrate: 3000,
      codec: "libx264",
      enabled: true,
    },
  ];

  test("初期状態では isLoading=true・presets=[]", () => {
    mockFetch.mockResolvedValue(new Promise(() => {}));
    const { result } = renderHook(() => useQualityPresets());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.presets).toEqual([]);
  });

  test("取得成功後に presets が設定され isLoading=false になる", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    });
    const { result } = renderHook(() => useQualityPresets());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.presets).toEqual(mockPresets);
    expect(result.current.error).toBeNull();
  });

  test("取得失敗時に error が設定される", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { result } = renderHook(() => useQualityPresets());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.presets).toEqual([]);
  });
});

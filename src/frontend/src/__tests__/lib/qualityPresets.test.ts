import { getQualityPresets, QualityPresetResponse } from '@/lib/qualityPresets';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockPresets: QualityPresetResponse[] = [
  {
    name: '1080p',
    width: 1920,
    height: 1080,
    fps: 30,
    bitrate: 6000,
    codec: 'libx264',
    enabled: false,
  },
  {
    name: '720p',
    width: 1280,
    height: 720,
    fps: 30,
    bitrate: 3000,
    codec: 'libx264',
    enabled: true,
  },
  {
    name: '480p',
    width: 854,
    height: 480,
    fps: 30,
    bitrate: 1500,
    codec: 'libx264',
    enabled: false,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getQualityPresets', () => {
  test('GET /quality_presets を呼び出す', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    });

    await getQualityPresets();

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/quality_presets'));
  });

  test('プリセット配列を返す', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    });

    const result = await getQualityPresets();

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe('1080p');
    expect(result[1].enabled).toBe(true);
    expect(result[2].name).toBe('480p');
  });

  test('enabled フィールドが含まれる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockPresets,
    });

    const result = await getQualityPresets();

    const enabled = result.filter((p) => p.enabled);
    expect(enabled).toHaveLength(1);
    expect(enabled[0].name).toBe('720p');
  });

  test('API エラー時に Error を投げる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal Server Error' }),
    });

    await expect(getQualityPresets()).rejects.toThrow();
  });
});

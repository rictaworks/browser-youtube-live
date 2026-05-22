/**
 * PR #1 — env.ts ユニットテスト
 * 対象: src/frontend/src/lib/env.ts
 */

// テスト前に環境変数をリセット
const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('env.ts — 環境判定', () => {
  test('APP_ENV が未設定の場合は development になる', async () => {
    delete process.env.NEXT_PUBLIC_APP_ENV;
    const { APP_ENV, isDevelopment, isProduction } = await import(
      '../../src/frontend/src/lib/env'
    );
    expect(APP_ENV).toBe('development');
    expect(isDevelopment).toBe(true);
    expect(isProduction).toBe(false);
  });

  test('APP_ENV=production のとき isProduction が true になる', async () => {
    process.env.NEXT_PUBLIC_APP_ENV = 'production';
    const { isDevelopment, isProduction } = await import(
      '../../src/frontend/src/lib/env'
    );
    expect(isProduction).toBe(true);
    expect(isDevelopment).toBe(false);
  });
});

describe('env.ts — config ハードコード検出', () => {
  test('apiBaseUrl に nextjs.org や vercel.com が含まれていない', async () => {
    const { config } = await import('../../src/frontend/src/lib/env');
    expect(config.apiBaseUrl).not.toMatch(/nextjs\.org|vercel\.com/);
  });

  test('bridgeWsUrl に nextjs.org や vercel.com が含まれていない', async () => {
    const { config } = await import('../../src/frontend/src/lib/env');
    expect(config.bridgeWsUrl).not.toMatch(/nextjs\.org|vercel\.com/);
  });

  test('config の各キーが空文字以外のデフォルト値を持つ（apiBaseUrl/bridgeWsUrl）', async () => {
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_BRIDGE_WS_URL;
    const { config } = await import('../../src/frontend/src/lib/env');
    expect(config.apiBaseUrl).not.toBe('');
    expect(config.bridgeWsUrl).not.toBe('');
  });
});

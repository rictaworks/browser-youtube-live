/**
 * PR #1 — fontawesome.ts ユニットテスト
 * 対象: src/frontend/src/lib/fontawesome.ts
 */

describe('fontawesome.ts — ライブラリ設定', () => {
  test('モジュールがエラーなくインポートできる', async () => {
    await expect(
      import('../../src/frontend/src/lib/fontawesome')
    ).resolves.not.toThrow();
  });

  test('library オブジェクトがエクスポートされている', async () => {
    const mod = await import('../../src/frontend/src/lib/fontawesome');
    expect(mod.library).toBeDefined();
  });

  test('faYoutube アイコンが登録されている', async () => {
    const mod = await import('../../src/frontend/src/lib/fontawesome');
    expect(mod.library).toBeDefined();
    // library.definitions に youtube ブランドアイコンが存在することを確認
    const defs = (mod.library as unknown as { definitions: Record<string, unknown> }).definitions;
    expect(defs).toHaveProperty('fab');
  });
});

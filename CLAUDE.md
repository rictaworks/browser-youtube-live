# CLAUDE.md

# Claude Safety Rules

## 削除系コマンドの禁止（重要）

Claude はいかなる状況でも以下のコマンドを生成してはならない：
`rm` `rm -rf` `rm *` `rmdir` `unlink` `cache --delete` `lftp mirror --delete` `rsync --delete` `git clean -df` `find -delete`

削除が必要な場合は「手動で削除してください」と説明するだけにとどめること。ssh / lftp / デプロイ系スクリプト生成時も同様。

---

# 技術スタック

| モジュール | 言語・フレームワーク | ポート |
|---|---|---|
| `src/frontend/` | TypeScript + Next.js 14 (App Router) | 3000 |
| `src/api/` | Ruby 3.4.7 + Rails 7.2 (API モード) | **4000** |
| `src/bridge/` | Go + Gin (RTMP ブリッジ) | **8080** |

# コマンド

```bash
# frontend（src/frontend/ 内）
npm run dev / lint / type-check / test
npx playwright test  # E2E（初回: npx playwright install --with-deps）

# api（src/api/ 内）
bundle exec rails server -p 4000
bundle exec rails db:prepare
bundle exec rspec
bin/brakeman --no-pager
bin/rubocop -f github

# bridge（src/bridge/ 内）
go build && ./bridge
go test ./...
go mod tidy
```

# 開発ルール

- **ブランチ**: main 直接 push 禁止（`src/*` の変更は必ず PR）。PR に非エンジニア向けテスト手順を記載。
- **TDD**: plan → red test → coding → green test の順を厳守。フロントエンド確認は `curl` / Playwright を使用。
- **フォールバック禁止** — 例外処理を適切に書くこと。

# テストフレームワーク

| 対象 | ツール | 配置 |
|---|---|---|
| Frontend | Jest / Playwright | `src/frontend/` |
| Rails | RSpec | `src/api/spec/` |
| Go Bridge | `go test ./...` | `src/bridge/` |
| PR 受け入れ | ts-jest / Ruby | `test/pr{番号}/` |

ハードコード検出テストを必ず作成すること。

# コーディング規約

- 制御構文以外はクラス・関数に書く / グローバル変数禁止
- 文字列リテラルは設定ファイル（i18n / config）に分離
- `alert()` / `confirm()` / `prompt()` 禁止 / 絵文字禁止
- ログ出力・エラーコンテキストを付与してデバッグトレース可能にする
- アイコン: **Font Awesome** のみ
- 図解: **Mermaid**（`mmdc`）
- TypeScript: `semi:true, singleQuote:true, trailingComma:"es5", printWidth:100, tabWidth:2` / `@/*` → `./src/*`
- `.ts` / `.tsx` は Write/Edit 後に Prettier が自動実行される（`.claude/settings.json` PostToolUse hook）— 手動実行不要
- Ruby: `rubocop-rails-omakase` 準拠

# 環境変数

ルートの `.env` で 3 モジュール共通管理。環境判定を実装して分岐すること。開発環境では認証済みに分岐すること。

| モジュール | キー | 備考 |
|---|---|---|
| Frontend | `NEXT_PUBLIC_API_URL` | Rails API の URL |
| Frontend | `NEXT_PUBLIC_WS_URL` | Go Bridge の WS URL |
| Rails | `SECRET_KEY_BASE` | 起動必須 |
| Rails | `DEVISE_JWT_SECRET_KEY` | JWT 署名キー |
| Rails | `STREAM_KEY_ENCRYPTION_KEY` | AES-256 StreamKey 暗号化 |
| Rails | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth2 |
| Go Bridge | `FFMPEG_PATH` | ヘルスチェックで検証 |
| Go Bridge | `FRONTEND_ORIGIN` | CORS 許可オリジン |

`src/api/config/master.key` — Rails credentials 復号化に必須（本番環境でも設定が必要）。

# セキュリティ

- commit 前に `/security-review` を実施すること
- OWASP Top 10 準拠（`claude-settings/OWASP10.md`）
- QC10 遵守（`claude-settings/QC10.md`）
- TM.md 記載テストを作成（`claude-settings/TM.md`）

# ディレクトリ

| ディレクトリ | 用途 |
|---|---|
| `TASKS/` | タスク管理 |
| `DEBUG/` | バグ報告 |
| `CLIENT/` | クライアント要望 |
| `WORK/` | 作業報告 |
| `ENV/` | 開発・本番環境情報 |
| `SPEC/` | 仕様書・リバースエンジニアリング成果物 |
| `DELETE/` | ゴミ箱（削除予定ファイル） |
| `agents/` | サブエージェント定義（9 ファイル） |
| `.claude/` | Claude Code 権限設定 |

# 参照

`claude-settings/`: CC.md · CRAP.md · OWASP10.md · QC10.md · TM.md · development-principles.md · auto-optimizer.md

`agents/`: @agents/（director · tester · deployer · designer · debugger · project-manager · service-manager · writer · data-scientist）

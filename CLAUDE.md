# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Safety Rules

## 削除系コマンドの禁止（重要）

以下のルールはこのワークスペース内のすべての会話で絶対に守られる：

- Claude はファイルまたはディレクトリを削除するコマンドを一切生成してはならない。
  例：rm, rm -rf, rm *, rmdir, unlink, cache --delete,
      lftp mirror --delete, rsync --delete, git clean -df, find -delete 等。

- 削除が必要な場合でも、Claude は削除コマンドを提案せず、
  「手動で削除してください」といった説明に留めること。

- 削除の推奨・削除操作の自動判断も禁止。

- ssh / lftp / デプロイ系スクリプトを生成する場合でも、
  削除コマンドの生成は禁止。

これらはすべての会話・コード生成に適用される。

---

# プロジェクト開発規約

## 技術スタック

| モジュール | 言語・フレームワーク | 起動ポート |
|---|---|---|
| `src/frontend/` | TypeScript + Next.js 14 (App Router) | 3000 |
| `src/api/` | Ruby 3.4.7 + Rails 7.2 (API モード) | **4000** |
| `src/bridge/` | Go + Gin (RTMP ブリッジ) | **8080** |

Rails は標準の 3000 ではなく **4000** 番で起動する。Go ブリッジは **8080** 番。

## モジュール別コマンド

```bash
# フロントエンド（src/frontend/ 内で実行）
npm run dev           # 開発サーバー起動
npm run lint          # ESLint
npm run type-check    # TypeScript 型チェック
npm test              # Jest テスト

# API（src/api/ 内で実行）
bundle exec rails server -p 4000   # 開発サーバー起動
bundle exec rails db:prepare       # DB 準備（初回・マイグレーション追加後）
bundle exec rspec                  # RSpec テスト
bin/brakeman --no-pager            # セキュリティスキャン
bin/rubocop -f github              # Linting

# Go ブリッジ（src/bridge/ 内で実行）
go build && ./bridge               # ビルド＆起動
go mod tidy                        # 依存関係整理
```

## ブランチ戦略

- **mainブランチでの作業禁止**。src/* 以外のファイル（設定ファイル等）のみ main への直接 push を許可する。
- `src/*` の変更はすべて PR を作成すること。
- PR には非エンジニア向けのユーザーテスト手順を丁寧に記載すること。

## TDD 厳守

**Red → Green → Refactor** サイクルを必ず守ること：

1. **plan** - 実装設計・タスク分解
2. **red test** - 失敗するテストを先に書く
3. **coding** - テストを通す最小限のコードを書く
4. **green test** - テストが通ることを確認してからリファクタ

フロントエンドの確認は `curl`、`wget --mirror`、または Playwright を使用すること。

## テストフレームワーク

- フロントエンド: Jest / Playwright
- バックエンド (Rails): RSpec（ユニットテストは `src/api/spec/` に配置）
- PR 受け入れテストは `test/pr***/` に配置し、開発サーバー（localhost:3000 / 4000）を対象とする
- ハードコード検出テストを必ず書くこと

## コーディング規約

- 制御構文・条件構文以外はクラスまたは関数に書くこと
- グローバル変数禁止（セキュリティ観点）
- 文字列リテラルは設定ファイル（i18n / config）に分離すること
- ネイティブの `alert()` / `confirm()` / `prompt()` 使用禁止
- フォールバック禁止 — 例外処理をしっかり書くこと
- デバッグトレースできるようにコードを書くこと（ログ出力、エラーコンテキストの付与）

### TypeScript / Prettier（`src/frontend/`）

`semi: true`, `singleQuote: true`, `trailingComma: "es5"`, `printWidth: 100`, `tabWidth: 2`

### Ruby（`src/api/`）

`rubocop-rails-omakase` スタイルに準拠。

## アイコン・UI

- デフォルトアイコンは **Font Awesome** を使用すること
- 絵文字禁止

## 環境変数

- ルートの `.env` で 3 モジュール共通管理。各モジュールでは `.env` を参照すること。
- 環境の判定を必ず実装して分岐できるようにすること
- 開発環境ではテストを容易にするため認証済みに分岐すること
- `src/api/config/master.key` は Rails credentials の復号化に必須。本番環境でも設定が必要。

## セキュリティ

- commit する前に security review を実施すること
- OWASP Top 10 に準拠すること（claude-settings/OWASP10.md 参照）
- QC10 チェックリストを遵守すること（claude-settings/QC10.md 参照）
- TM に記載されたテストを作成すること（claude-settings/TM.md 参照）
- CC.md / CRAP.md を参照すること

## 図解

- 図解は **Mermaid** を使用すること（`mmdc` コマンド）
- ER図、DFD、シーケンス図、クラス図、状態遷移図、ユースケース図

## ディレクトリ管理

| ディレクトリ | 用途 |
|---|---|
| `TASKS/` | タスク管理 |
| `DEBUG/` | バグ報告 |
| `CLIENT/` | クライアント要望 |
| `WORK/` | 作業報告 |
| `ENV/DEVELOPMENT.md` | 開発環境情報 |
| `ENV/PRODUCTION.md` | 本番環境情報 |
| `SPEC/` | 仕様書・リバースエンジニアリング成果物 |
| `DELETE/` | ゴミ箱（削除予定ファイル） |
| `agents/` | サブエージェント定義（director, tester, deployer 等 9 ファイル） |
| `.claude/` | Claude Code 権限設定（settings.local.json） |

---

## Sub Agents (/agents)

### pr-checker
- 全 PR をレビューする（内容のレビューではなく日本語化・ユーザーテスト記載）
- 全 PR のタイトル・本文を日本語にすること
- 非エンジニア向けのユーザーテスト手順を PR 本文に丁寧に書くこと

### tester
- 全 PR を対象として、PR に書かれたユーザーテスト手順の実行スクリプトを作成すること
- TM.md に記載されたテストを作成すること（Jest, RSpec 等）
- テストは `test/pr***/` に配置すること
- テストの対象は開発サーバーとすること

---

## 参照ファイル

- `claude-settings/CC.md` - コーディング規約詳細
- `claude-settings/CRAP.md` - コード品質基準
- `claude-settings/OWASP10.md` - セキュリティチェック
- `claude-settings/QC10.md` - 品質管理チェックリスト
- `claude-settings/TM.md` - テストメソッド
- `claude-settings/auto-optimizer.md` - 自動最適化設定
- `claude-settings/development-principles.md` - 開発原則

# browser-youtube-live

ブラウザベースの YouTube ライブ配信管理ツール。

---

## 開発環境のセットアップ

```bash
# 1. 環境変数設定
cp .env.example .env
# .env を編集して各値を設定

# 2. Rails API（src/api/ 内）
bundle install
bundle exec rails db:prepare
bundle exec rails server -p 4000

# 3. フロントエンド（src/frontend/ 内）
npm install
npm run dev   # ポート 3000

# 4. Go ブリッジ（src/bridge/ 内）
go build && ./bridge   # ポート 8080
```

---

## ページ一覧

| ページ名 | URL | 説明 |
|---|---|---|
| ホーム（配信管理） | `/` | ログイン・カメラ/画面プレビュー・配信開始/停止・統計表示 |
| 配信履歴 | `/history` | 過去の配信一覧（ページネーション対応） |

---

## API 一覧

### Rails API（ポート 4000）

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/auth/google/callback` | Google OAuth2 認証コールバック |
| GET | `/auth/me` | ログイン中ユーザー情報取得 |
| DELETE | `/auth/sign_out` | ログアウト |
| GET | `/quality_presets` | 利用可能な配信品質プリセット一覧 |
| GET | `/stream_sessions` | 配信履歴一覧（`?page=1&per_page=20`） |
| POST | `/stream_sessions` | 配信セッション作成（YouTube Broadcast 作成） |
| PATCH | `/stream_sessions/:id/end` | 配信終了 |
| GET | `/stream_sessions/:id/stats` | 配信統計情報取得 |
| POST | `/stream_sessions/:id/recover` | セッション回復（切断時の再接続） |

### Go ブリッジ（ポート 8080）

| メソッド | エンドポイント | 説明 |
|---|---|---|
| GET | `/health` | ヘルスチェック（FFmpeg 動作確認） |
| GET | `/ws` | WebSocket 接続（映像バイナリ受信） |
| POST | `/bridge/sessions` | ブリッジセッション登録 |
| DELETE | `/bridge/sessions/:id` | ブリッジセッション終了 |
| POST | `/bridge/sessions/:id/stats` | 配信統計プッシュ |

---

## ディレクトリ構成

```
.
├── src/              # ソースコード（変更はPR必須）
├── agents/           # エージェント定義
│   ├── director.md
│   ├── project-manager.md
│   ├── designer.md
│   ├── debugger.md
│   ├── tester.md
│   ├── data-scientist.md
│   ├── deployer.md
│   ├── writer.md
│   └── service-manager.md
├── TASKS/            # タスク管理
├── DEBUG/            # バグ報告
├── CLIENT/           # クライアント要望
├── WORK/             # 作業報告
├── ENV/              # 環境設定ドキュメント
│   ├── DEVELOPMENT.md
│   └── PRODUCTION.md
├── SPEC/             # 仕様書・ER図・シーケンス図等
├── DELETE/           # ゴミ箱
├── test/             # テスト (test/pr{番号}/ 形式)
├── claude-settings/  # Claude 開発規約参照ファイル
└── CLAUDE.md         # Claude 動作規約
```

---

## 開発規約

- TDD 厳守（Red → Green → Refactor）
- `src/*` の変更は PR 必須、main への直接 push 禁止
- アイコンは Font Awesome を使用、絵文字禁止
- セキュリティ: commit 前に security review 実施
- 詳細は [CLAUDE.md](./CLAUDE.md) を参照

---

## 開発方針

### AI 役割分担

| フェーズ | 担当モデル |
|---|---|
| 設計・Issue 発行 | Claude Sonnet |
| 実装 | Claude Sonnet |
| コードレビュー | Claude Sonnet |
| テスト作成・実行 | Claude Sonnet |
| セキュリティレビュー | Claude Opus |

### リリースフロー

1. 各 Issue を上記役割分担で実装・レビュー・マージ
2. **全 Issue 完了後**に人力コードレビューを実施
3. **全 Issue 完了後**にユーザーテスト（実機確認）を実施

# browser-youtube-live

ブラウザベースの YouTube ライブ配信管理ツール。

---

## 開発環境のセットアップ

```bash
# 依存関係インストール
npm install

# 環境変数の設定
cp .env.example .env
# .env を編集して各値を設定

# 開発サーバー起動
npm run dev
```

---

## ページ一覧

| ページ名 | URL |
|---|---|
| （実装後に追記） | - |

---

## API 一覧

| タイトル | エンドポイント URL |
|---|---|
| （実装後に追記） | - |

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

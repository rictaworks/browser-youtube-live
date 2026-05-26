# ER図（実装版）

実際の `db/structure.sql` と Rails モデルをもとにリバースエンジニアリングした図。

```mermaid
erDiagram
    users {
        uuid   id              PK
        string email           "UNIQUE / 暗号化なし"
        string name
        string google_id       "UNIQUE"
        text   youtube_token   "AES-256 暗号化"
        text   youtube_refresh_token "AES-256 暗号化"
        datetime token_expiry
        datetime created_at
        datetime updated_at
    }

    stream_sessions {
        uuid     id           PK
        uuid     user_id      FK
        string   broadcast_id "YouTube Broadcast ID"
        text     stream_key   "AES-256 暗号化"
        string   rtmp_url
        string   status       "created|starting|live|ended|error"
        string   quality      "360p|480p|720p|1080p"
        datetime started_at
        datetime ended_at
        integer  duration_sec "nullable"
        integer  max_viewers  "nullable"
        text     error_message
        datetime created_at
        datetime updated_at
    }

    stream_stats {
        uuid     id                PK
        uuid     stream_session_id FK
        datetime recorded_at
        integer  bitrate_kbps
        decimal  fps               "精度 5,2"
        integer  dropped_frames
        integer  viewer_count
        integer  buffer_size_kb
    }

    quality_presets {
        uuid    id      PK
        string  name    "UNIQUE (例: 720p)"
        integer width
        integer height
        integer fps
        integer bitrate "kbps"
        string  codec
        boolean enabled "デモ版では 720p のみ true"
        datetime created_at
        datetime updated_at
    }

    users         ||--o{ stream_sessions : "has_many"
    stream_sessions ||--o{ stream_stats  : "has_many"
```

## 備考

- `duration_sec` / `max_viewers` はスキーマ上はカラムとして存在するが、`GET /stream_sessions` の `history_json` では `ended_at - started_at` の計算値と `stream_stats` の集計値を返す。カラム値は現状 NULL のまま。
- `stream_key` は `ActiveRecord::Encryption` により AES-256 で暗号化して保存。
- `youtube_token` / `youtube_refresh_token` も同様に暗号化。

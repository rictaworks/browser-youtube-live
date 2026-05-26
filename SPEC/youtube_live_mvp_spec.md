# ブラウザからYouTubeライブ配信 MVP 設計仕様書

**バージョン:** 1.0  
**作成日:** 2026-05-15  
**対象:** MVP（Minimum Viable Product）  

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [アーキテクチャ概要](#2-アーキテクチャ概要)
3. [機能仕様書](#3-機能仕様書)
4. [ER図](#4-er図)
5. [DFD（データフロー図）](#5-dfdデータフロー図)
6. [シーケンス図](#6-シーケンス図)
7. [クラス図](#7-クラス図)
8. [状態遷移図](#8-状態遷移図)
9. [ユースケース図](#9-ユースケース図)
10. [デモ版仕様](#10-デモ版仕様)
11. [技術スタック詳細](#11-技術スタック詳細)
12. [デプロイ構成](#12-デプロイ構成)
13. [制約・注意事項](#13-制約注意事項)

---

## 1. プロジェクト概要

### 1.1 目的

ブラウザ（Chrome/Firefox/Safari）だけで、専用ソフトウェア（OBS等）不要で YouTube へライブ配信できる Web アプリケーションを提供する。

### 1.2 解決する課題

| 課題 | 解決策 |
|------|--------|
| OBS等の専用ソフト不要 | WebRTC/MediaStream API でブラウザから直接取得 |
| RTMP変換の複雑さ | サーバーサイドFFmpegブリッジ（Go/Gin） |
| YouTubeセットアップの煩雑さ | YouTube Data API v3 で自動作成 |
| 配信品質の不安定さ | アダプティブビットレート制御 |

### 1.3 ターゲットユーザー

- 個人クリエイター（ゲーム配信、トーク配信）
- 企業の軽量ライブ配信担当者
- OBSセットアップが難しいライトユーザー

---

## 2. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────────────┐
│  ブラウザ (Next.js / TypeScript)                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ MediaStream  │  │ Canvas Mixer │  │ WebSocket Client     │   │
│  │ (カメラ/画面) │  │ (合成処理)   │  │ (バイナリ送信)       │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ WebSocket (H.264/AAC チャンク)
┌───────────────────────────────▼─────────────────────────────────┐
│  RTMPブリッジサーバー (Go / Gin)                                   │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ WebSocket Handler│  │ FFmpeg Proc  │  │ Session Manager  │   │
│  │ (受信・バッファ)  │  │ (RTMP変換)   │  │ (プロセス管理)   │   │
│  └──────────────────┘  └──────────────┘  └──────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │ RTMP
                    ┌───────────▼───────────┐
                    │  YouTube Live (RTMP)  │
                    └───────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  APIサーバー (Rails / Ruby)                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Auth (OAuth) │  │ Session API  │  │ YouTube Data API連携 │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  PostgreSQL            │
                    └───────────────────────┘
```

---

## 3. 機能仕様書

### 3.1 機能一覧

| 機能ID | 機能名 | 優先度 | 説明 |
|--------|--------|--------|------|
| F01 | Google認証ログイン | Must | OAuth2でYouTubeアカウント連携 |
| F02 | カメラ映像取得 | Must | getUserMediaでカメラ・マイク取得 |
| F03 | 画面共有取得 | Should | getDisplayMediaで画面キャプチャ |
| F04 | カメラ+画面合成 | Should | Canvas APIで2ソース合成 |
| F05 | 配信開始 | Must | YouTube Broadcast作成→RTMP配信開始 |
| F06 | 配信停止 | Must | 安全なセッション終了・リソース解放 |
| F07 | 配信品質選択 | Should | 1080p/720p/480p切り替え |
| F08 | ステータス監視 | Must | ビットレート・視聴者数・配信時間表示 |
| F09 | アダプティブ品質制御 | Should | ネット状況に応じて自動品質調整 |
| F10 | セッション回復 | Should | 切断時の自動再接続 |
| F11 | 配信履歴 | Could | 過去の配信一覧表示 |

### 3.2 関数仕様（確定版）

#### manageStreamSession
```
入力:  userId: string, youtubeToken: OAuthToken
処理:
  1. YouTube LiveBroadcasts.insert でブロードキャスト作成
  2. YouTube LiveStreams.insert でストリームキー取得
  3. broadcastとstreamをbind
  4. セッション情報をDBに保存 (status: 'created')
  5. RTMPブリッジサーバーへセッション登録
出力: { broadcastId, streamKey, rtmpUrl, sessionId, streamingUrl }
エラー:
  - quota超過 → QuotaExceededError
  - チャンネル未設定 → ChannelNotConfiguredError
```

#### captureUserMedia
```
入力:  config: { video: bool, audio: bool, screen: bool, quality: '1080p'|'720p'|'480p' }
処理:
  1. qualityに応じた制約設定 (1080p: {width:1920, height:1080, frameRate:30})
  2. video=trueならgetUserMediaでカメラ+マイク取得
  3. screen=trueならgetDisplayMediaで画面取得
  4. 両方trueならCanvasでオーバーレイ合成 (カメラをPiP配置)
  5. MediaRecorder初期化 (mimeType: 'video/webm;codecs=vp8,opus')
出力: { stream: MediaStream, recorder: MediaRecorder }
エラー:
  - 権限拒否 → PermissionDeniedError
  - デバイス未検出 → DeviceNotFoundError
```

#### bridgeWebSocketToRTMP
```
入力:  wsConn: WebSocketConn, rtmpUrl: string, streamKey: string
処理:
  1. WebSocketでバイナリチャンク受信
  2. FFmpegプロセス起動:
     ffmpeg -re -i pipe:0 -vcodec libx264 -acodec aac
            -f flv rtmp://{rtmpUrl}/{streamKey}
  3. チャンクをFFmpegのstdinにパイプ
  4. バッファサイズ監視 (上限: 10MB → 警告)
  5. プロセス死活監視 (1秒間隔)
出力: StreamStats { bitrate, fps, droppedFrames, bufferSize }
エラー:
  - FFmpegクラッシュ → 自動再起動(最大3回)
  - RTMP接続失敗 → RTMPConnectionError
```

#### monitorStreamHealth
```
入力:  sessionId: string, broadcastId: string
処理:
  1. 3秒ごとにYouTube API LiveBroadcasts.list でstatus取得
  2. stats (bitrate, fps) をWebSocketでフロントへプッシュ
  3. "live"遷移検知でDB更新・UI通知
  4. エラー検知で自動リトライ (指数バックオフ, 最大3回)
出力: StreamHealth { status, bitrate, viewers, elapsedTime, errors }
```

#### terminateStream
```
入力:  sessionId: string, broadcastId: string
処理:
  1. YouTube API transition(complete) でbroadcast終了
  2. FFmpegプロセスにSIGTERMを送信 (5秒後にSIGKILL)
  3. WebSocket接続をcloseフレームで閉じる
  4. DBセッションを status: 'completed', ended_at: now() に更新
  5. 孤立プロセスのガベージコレクション
出力: { success, recordingUrl?, duration }
```

#### recoverSession
```
入力:  sessionId: string
処理:
  1. DBからセッション最終状態を取得
  2. FFmpegプロセス生存確認
  3. 死亡時: 新規プロセス起動, rtmpUrl/streamKey 再利用
  4. YouTube APIでbroadcast有効性確認
  5. 無効時: 新規broadcast作成→UIへ通知
出力: { recovered: bool, newSessionId?: string }
```

#### adaptStreamQuality
```
入力:  stats: { bitrate, droppedFrames, networkSpeed }
処理:
  1. 直近10秒のフレームドロップ率計算
  2. 5%超過 → ビットレート25%削減
  3. 0%が30秒継続 → ビットレート25%増加
  4. 解像度フォールバック順: 1080p→720p→480p→360p
  5. 変更をFFmpegに動的反映 (-b:v フラグ更新)
出力: { newBitrate, newResolution, action: 'upgrade'|'downgrade'|'stable' }
```

---

## 4. ER図

```
┌─────────────────────┐       ┌─────────────────────────┐
│       users         │       │    stream_sessions      │
├─────────────────────┤       ├─────────────────────────┤
│ id          UUID PK │──┐    │ id             UUID PK  │
│ email       VARCHAR │  │    │ user_id        UUID FK  │◄─┐
│ name        VARCHAR │  └───►│ broadcast_id   VARCHAR  │  │
│ google_id   VARCHAR │       │ stream_key     VARCHAR  │  │
│ youtube_token TEXT  │       │ rtmp_url       VARCHAR  │  │
│ token_expiry TIMESTAMP│     │ status         ENUM     │  │
│ created_at  TIMESTAMP│      │   (created/starting/    │  │
│ updated_at  TIMESTAMP│      │    live/ended/error)    │  │
└─────────────────────┘       │ quality        ENUM     │  │
                              │   (360p/480p/720p/1080p)│  │
                              │ started_at     TIMESTAMP│  │
                              │ ended_at       TIMESTAMP│  │
                              │ duration_sec   INTEGER  │  │
                              │ max_viewers    INTEGER  │  │
                              │ error_message  TEXT     │  │
                              │ created_at     TIMESTAMP│  │
                              └─────────────────────────┘  │
                                          │                  │
                              ┌───────────▼───────────────┐ │
                              │     stream_stats           │ │
                              ├───────────────────────────┤ │
                              │ id           UUID PK      │ │
                              │ session_id   UUID FK      │─┘
                              │ recorded_at  TIMESTAMP    │
                              │ bitrate_kbps INTEGER      │
                              │ fps          DECIMAL      │
                              │ dropped_frames INTEGER    │
                              │ viewer_count INTEGER      │
                              │ buffer_size_kb INTEGER    │
                              └───────────────────────────┘

┌─────────────────────┐
│   quality_presets   │
├─────────────────────┤
│ id       UUID PK    │
│ name     VARCHAR    │  例: '720p Standard'
│ width    INTEGER    │
│ height   INTEGER    │
│ fps      INTEGER    │
│ bitrate  INTEGER    │  (kbps)
│ codec    VARCHAR    │
└─────────────────────┘
```

---

## 5. DFD（データフロー図）

### レベル0（コンテキスト図）

```
                    ┌──────────────────────────┐
  [配信者]          │                          │        [YouTube]
  ───映像/音声──►   │  YouTubeLive配信MVP      │  ───RTMP配信──►
  ◄──配信状態───   │                          │  ◄──配信状態───
                    └──────────────────────────┘
                              │    ▲
                    Google認証│    │ユーザー情報
                              ▼    │
                         [Google OAuth]
```

### レベル1（主要プロセス）

```
配信者
  │
  │ ①Googleログイン
  ▼
[1.0 認証処理]──►[Users DB]
  │
  │ ②配信設定・開始指示
  ▼
[2.0 セッション管理]──►[Sessions DB]
  │         │
  │         └──►[YouTube API]──►YouTube Broadcast作成
  │                               ストリームキー取得
  │ ③MediaStream
  ▼
[3.0 メディア取得・エンコード]
  │
  │ ④WebSocketバイナリ
  ▼
[4.0 RTMPブリッジ(Go/Gin)]──►FFmpegプロセス──►YouTube RTMP
  │
  │ ⑤配信ステータス
  ▼
[5.0 ヘルス監視]──►[Stats DB]
  │
  │ ⑥リアルタイム状態
  ▼
配信者ダッシュボード

[6.0 配信終了処理]
  ├──►YouTube API (complete)
  ├──►FFmpegプロセス終了
  ├──►WebSocket切断
  └──►[Sessions DB 更新]
```

---

## 6. シーケンス図

### 6.1 配信開始シーケンス

```
配信者(Browser)     Next.js Frontend    Rails API      Go/Gin Bridge    YouTube API     PostgreSQL
     │                    │                │                │                │               │
     │──Googleログイン──►│                │                │                │               │
     │                    │──OAuth認証──►│                │                │               │
     │                    │              │──ユーザー保存──────────────────────────────────►│
     │                    │◄──JWT Token──│                │                │               │
     │                    │                │                │                │               │
     │──配信開始ボタン──►│                │                │                │               │
     │                    │──POST /sessions──►│            │                │               │
     │                    │              │──Broadcast作成─────────────────►│               │
     │                    │              │◄──broadcastId, streamKey────────│               │
     │                    │              │──セッション保存────────────────────────────────►│
     │                    │◄──{ sessionId, streamKey }──│  │               │               │
     │                    │                │                │                │               │
     │                    │──WS接続開始──────────────────►│                │               │
     │                    │◄──WS接続確立─────────────────│                │               │
     │                    │──streamKey送信────────────────►│               │               │
     │                    │              │                │──FFmpeg起動──►(RTMP)          │
     │                    │                │                │                │               │
     │◄──getUserMedia──  │                │                │                │               │
     │──MediaStream許可─►│                │                │                │               │
     │                    │──バイナリチャンク(WS)──────────►│              │               │
     │                    │              │                │──RTMP転送──────────────────────►
     │                    │                │                │                │               │
     │                    │──GET /sessions/{id}/status──►│                 │               │
     │                    │              │──ステータス確認──────────────────►│              │
     │                    │              │◄──status: "live"────────────────│               │
     │◄──"配信中"表示──  │◄──status update──│             │               │               │
```

### 6.2 配信終了シーケンス

```
配信者(Browser)     Next.js         Rails API      Go/Gin Bridge    YouTube API    PostgreSQL
     │                │                │                │                │               │
     │──終了ボタン──►│                │                │                │               │
     │                │──PATCH /sessions/{id}/end──►│  │               │               │
     │                │              │──transition(complete)──────────►│               │
     │                │              │◄──success────────────────────── │               │
     │                │              │──WS終了指示────►│               │               │
     │                │              │               │──SIGTERM→FFmpeg │               │
     │                │              │               │──WS close────── │               │
     │                │              │──DB更新 status:completed───────────────────────►│
     │◄──"配信終了"──│◄──200 OK──── │               │                │               │
```

---

## 7. クラス図

```
┌───────────────────────────────────┐
│          StreamController         │  ← Next.js側
├───────────────────────────────────┤
│ - sessionId: string               │
│ - mediaStream: MediaStream        │
│ - recorder: MediaRecorder         │
│ - wsClient: WebSocketClient       │
│ - status: StreamStatus            │
├───────────────────────────────────┤
│ + startStream(config): Promise    │
│ + stopStream(): Promise           │
│ + getStatus(): StreamStatus       │
│ + switchQuality(q: Quality): void │
└──────────────┬────────────────────┘
               │ uses
┌──────────────▼────────────────────┐
│         MediaCapture              │
├───────────────────────────────────┤
│ - cameraStream: MediaStream       │
│ - screenStream: MediaStream       │
│ - canvas: HTMLCanvasElement       │
├───────────────────────────────────┤
│ + capture(config): MediaStream    │
│ + mix(): MediaStream              │
│ + release(): void                 │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│         WebSocketClient           │
├───────────────────────────────────┤
│ - url: string                     │
│ - socket: WebSocket               │
│ - reconnectAttempts: number       │
├───────────────────────────────────┤
│ + connect(): Promise              │
│ + sendChunk(data: ArrayBuffer)    │
│ + disconnect(): void              │
│ + onReconnect(fn: Function): void │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│       StreamSession (Rails)       │  ← Rails側 ActiveRecord
├───────────────────────────────────┤
│ - id: UUID                        │
│ - userId: UUID                    │
│ - broadcastId: string             │
│ - streamKey: string               │
│ - status: StreamStatus            │
│ - quality: Quality                │
├───────────────────────────────────┤
│ + create(params): StreamSession   │
│ + transition(status): bool        │
│ + complete(): bool                │
│ + stats(): StreamStats[]          │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│       RTMPBridge (Go/Gin)         │
├───────────────────────────────────┤
│ - sessions: map[string]*Session   │
│ - ffmpegProcs: map[string]*Cmd    │
├───────────────────────────────────┤
│ + HandleWS(ctx: gin.Context)      │
│ + StartFFmpeg(key, url): error    │
│ + StopFFmpeg(sessionId): error    │
│ + RecoverSession(id): error       │
│ + GetStats(id): StreamStats       │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│     QualityAdaptor (Go)           │
├───────────────────────────────────┤
│ - history: []FrameStats           │
│ - currentBitrate: int             │
│ - currentResolution: Resolution   │
├───────────────────────────────────┤
│ + Evaluate(stats: FrameStats)     │
│ + Upgrade(): Action               │
│ + Downgrade(): Action             │
│ + Apply(proc: *Cmd): error        │
└───────────────────────────────────┘

<<enum>> StreamStatus
  created | starting | live | ended | error | recovering

<<enum>> Quality
  360p | 480p | 720p | 1080p
```

---

## 8. 状態遷移図

```
                         ┌──────────┐
                         │  IDLE    │ ← 初期状態
                         └────┬─────┘
                              │ 配信開始ボタン押下
                              ▼
                         ┌──────────┐
                         │ CREATING │ ← YouTube Broadcast作成中
                         └────┬─────┘
                    成功 │         │ 失敗(API Error)
                         ▼         ▼
                   ┌──────────┐  ┌───────┐
                   │CONNECTING│  │ ERROR │
                   └────┬─────┘  └───┬───┘
         WS接続+FFmpeg  │             │ リトライ
                         ▼             │
                   ┌──────────┐◄──────┘
                   │STREAMING │ ← バイナリ送信中
                   └────┬─────┘
              YouTubeが  │        │ ネット断
              受信開始   ▼        ▼
                   ┌──────────┐  ┌────────────┐
                   │   LIVE   │  │RECONNECTING│
                   └────┬─────┘  └─────┬──────┘
           終了ボタン   │   接続復帰    │
                         ▼         ◄───┘
                   ┌──────────┐
                   │ ENDING   │ ← YouTube API complete呼び出し中
                   └────┬─────┘
                         │ 完了
                         ▼
                   ┌──────────┐
                   │COMPLETED │ ← 終了・録画URL確認
                   └──────────┘

※ LIVE状態でのサブ状態（品質制御）:
  LIVE
  ├── QUALITY_STABLE    (ドロップ0%)
  ├── QUALITY_WARNING   (ドロップ1-5%)
  └── QUALITY_DEGRADING (ドロップ5%超 → 自動ダウングレード)
```

---

## 9. ユースケース図

```
アクター: 配信者 (Streamer)
アクター: YouTubeプラットフォーム
アクター: Googleアカウント

┌─────────────────────────────────────────────────────────┐
│              YouTubeLive配信MVPシステム                   │
│                                                         │
│  配信者 ──► [Googleでログイン]                           │
│                  │ <<include>>                          │
│                  └──► [OAuthトークン取得]                │
│                                                         │
│  配信者 ──► [配信を開始する]                             │
│                  │ <<include>>                          │
│                  ├──► [カメラ/マイクを取得する]          │
│                  ├──► [画面を共有する] <<extend>>        │
│                  ├──► [YouTube配信枠を作成する]          │
│                  └──► [RTMP接続を確立する]               │
│                                                         │
│  配信者 ──► [配信品質を設定する]                         │
│                  │ <<extend>>                           │
│                  └──► [アダプティブ品質制御]             │
│                                                         │
│  配信者 ──► [配信ステータスを確認する]                   │
│                  │ <<include>>                          │
│                  ├──► [視聴者数を確認する]               │
│                  ├──► [ビットレートを確認する]           │
│                  └──► [配信時間を確認する]               │
│                                                         │
│  配信者 ──► [配信を終了する]                             │
│                  │ <<include>>                          │
│                  └──► [リソースをクリーンアップする]     │
│                                                         │
│  配信者 ──► [配信履歴を見る] <<extend>>                  │
│                                                         │
│                    [切断から回復する] ── <<extend>> ── 配信者
│                                                         │
└─────────────────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
 [Googleアカウント]          [YouTubeプラットフォーム]
 (認証・認可)                (RTMP受信・配信)
```

---

## 10. デモ版仕様

### 10.1 マスタデータ件数

| テーブル | 本番想定 | **デモ版件数** | 内容 |
|---------|---------|--------------|------|
| users | 無制限 | **3件** | admin, demo_streamer1, demo_streamer2 |
| stream_sessions | 無制限 | **5件** | 過去配信履歴サンプル |
| stream_stats | 無制限 | **50件** | 1セッション×10分×5レコード/分 |
| quality_presets | 4件固定 | **4件** | 360p/480p/720p/1080p |

### 10.2 デモ版の制約事項

> **⚠️ 重要: デモ版では最小単位のデータでしかテストできません**
>
> デモ版は機能検証・UX確認を目的としており、以下の制約があります。

| 制約項目 | デモ版 | 本番版 |
|---------|-------|-------|
| 同時配信セッション数 | **1セッションのみ** | 無制限（インフラ次第） |
| 最大配信時間 | **30分** | 制限なし |
| 配信品質 | **720pのみ** | 360p/480p/720p/1080p |
| YouTube API呼び出し | **実際のYouTube API使用** | 同左（quota注意） |
| ユーザー数 | **3アカウント固定** | 無制限 |
| 統計データ精度 | **5秒間隔** | 1秒間隔 |
| セッション履歴保持 | **7日間** | 90日間 |
| 同時接続ユーザー | **1名** | スケールアウト対応 |

> デモ版では単一ユーザーによる単一セッションの基本フロー（ログイン→配信開始→配信停止）のみを検証できます。負荷テスト・並列処理・長時間配信の品質劣化テストは本番環境構築後に実施してください。

---

## 11. 技術スタック詳細

### フロントエンド (Vercel)
- **Next.js 14** (App Router, TypeScript)
- **WebRTC API** - MediaStream, MediaRecorder
- **Canvas API** - 映像合成
- **WebSocket** - バイナリストリーミング
- **TailwindCSS** - スタイリング
- **SWR** - データフェッチ・キャッシュ

### バックエンド API (Render / Railway)
- **Rails 7** (Ruby, API mode)
- **google-api-client gem** - YouTube Data API v3
- **devise-jwt** - JWT認証
- **pg gem** - PostgreSQL接続
- **sidekiq** - バックグラウンドジョブ（ステータス監視）

### RTMPブリッジ (Render / Railway)
- **Go 1.22 + Gin** - WebSocketハンドリング・高速並列処理
- **gorilla/websocket** - WebSocket実装
- **FFmpeg** - WebRTC→RTMP変換
- **os/exec** - FFmpegプロセス管理

### データベース
- **PostgreSQL 15** - メインDB (Render提供 / Railway提供)

### 認証
- **Google OAuth2** - ログイン・YouTube権限取得
- スコープ: `https://www.googleapis.com/auth/youtube`

---

## 12. デプロイ構成

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Vercel    │     │  Render/Railway  │     │  Render/Railway │
│  (無料枠)   │     │    (無料枠)      │     │    (無料枠)     │
│             │     │                  │     │                  │
│  Next.js    │────►│  Rails API       │────►│  Go/Gin Bridge  │
│  Frontend   │     │  :3000           │     │  :8080          │
│             │     │                  │     │  + FFmpeg       │
└──────────────┘     └─────────┬────────┘     └─────────────────┘
                               │
                     ┌─────────▼────────┐
                     │  PostgreSQL      │
                     │  (Render提供 /  │
                     │   Railway提供)  │
                     └──────────────────┘
```

### 無料枠の制約
| サービス | 無料枠制約 | 対策 |
|---------|-----------|------|
| Vercel | 帯域100GB/月 | 映像はGo経由で直接送信 |
| Render | スリープ(15分無操作) | ヘルスチェックpingで維持 |
| Railway | $5クレジット/月 | 使用量監視 |
| PostgreSQL | 1GB | statsの定期パージ |

---

## 13. 制約・注意事項

### YouTube API Quota
- 1日あたり10,000ユニット
- LiveBroadcasts.insert: 50ユニット
- LiveStreams.insert: 50ユニット
- **1日最大約100セッション作成可能**
- Quota超過時はユーザーへ通知・翌日まで待機

### ブラウザ互換性
| ブラウザ | カメラ配信 | 画面共有 |
|---------|----------|---------|
| Chrome 90+ | ✅ | ✅ |
| Firefox 90+ | ✅ | ✅ |
| Safari 15+ | ✅ | ⚠️ 制限あり |
| Edge 90+ | ✅ | ✅ |

### セキュリティ
- StreamKey は暗号化してDBに保存 (AES-256)
- WebSocketはWSS(TLS)必須
- CORS設定でフロントドメインのみ許可
- YouTubeトークンはサーバーサイドのみ保持

---

*本仕様書はMVPフェーズの設計ドキュメントです。スケールアップ時はRTMPブリッジのKubernetes化、CDN導入、Redis追加を検討してください。*

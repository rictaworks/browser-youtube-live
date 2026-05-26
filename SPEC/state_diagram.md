# 状態遷移図（実装版）

## フロントエンド配信状態（StreamSessionState）

`src/frontend/src/hooks/useStreamSession.ts` の実装をもとにした図。

```mermaid
stateDiagram-v2
    [*] --> IDLE

    IDLE --> CREATING : 配信開始ボタン押下

    CREATING --> CONNECTING : POST /stream_sessions 成功\nPOST /bridge/sessions 成功
    CREATING --> ERROR : API エラー\n(quota超過・チャンネル未設定)

    CONNECTING --> STREAMING : WebSocket 接続確立\nMediaRecorder 起動
    CONNECTING --> ERROR : WS 接続失敗

    STREAMING --> ENDING : 配信停止ボタン押下
    STREAMING --> RECONNECTING : WebSocket 切断検知\n(attempt=1)

    RECONNECTING --> STREAMING : 再接続成功\n(POST /recover → WS 再確立)
    RECONNECTING --> RECONNECTING : 再試行\n(attempt++)
    RECONNECTING --> ERROR : 最大再試行回数超過\n(MAX_RECONNECT_ATTEMPTS=3)

    ENDING --> COMPLETED : DELETE /bridge/sessions\nPATCH /stream_sessions/:id/end 完了
    ENDING --> ERROR : API エラー

    COMPLETED --> IDLE : 画面リセット
    ERROR --> IDLE : エラー解除・リセット

    note right of RECONNECTING
        再試行間隔: 2s → 4s → 8s
        (指数バックオフ)
    end note
```

## Rails StreamSession ステータス（DB）

`stream_sessions.status` カラムの有効値と遷移。

```mermaid
stateDiagram-v2
    [*] --> created : POST /stream_sessions

    created --> starting : YouTube Broadcast 遷移待ち
    starting --> live : YouTube が配信受信開始
    live --> ended : PATCH /stream_sessions/:id/end
    created --> ended : 配信前に終了
    live --> error : FFmpeg クラッシュ・API エラー
    starting --> error : タイムアウト

    note right of created
        PATCH /recover 時に
        新 Broadcast へ更新可能
    end note
```

## Go ブリッジ FFmpeg プロセス状態

```mermaid
stateDiagram-v2
    [*] --> Running : FFmpegRunner.Start()

    Running --> Crashed : プロセス終了（異常）\nDone() チャネルがクローズ
    Running --> Stopped : Session.Stop() 呼び出し\n(SIGTERM → 5秒後 SIGKILL)

    Crashed --> Running : 自動再起動\n(restartCount <= 3)
    Crashed --> Closed : 最大再起動回数超過

    Stopped --> Running : 品質変更による再起動\n(SendRestart)
    Stopped --> [*] : セッション終了

    Closed --> [*] : WS クローズ (1011)
```

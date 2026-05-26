# シーケンス図（実装版）

## 1. 認証フロー（Google OAuth2）

```mermaid
sequenceDiagram
    actor User as 配信者
    participant FE as Next.js :3000
    participant Rails as Rails API :4000
    participant Google as Google OAuth2

    User->>FE: ログインボタン押下
    FE->>Google: リダイレクト /auth/google
    Google-->>Rails: GET /auth/google/callback?code=...
    Rails->>Google: トークン取得
    Google-->>Rails: access_token / refresh_token
    Rails->>Rails: User.from_google() 保存/更新
    Rails->>Rails: JwtService.encode(user_id)
    Rails-->>FE: Set-Cookie: jwt_token=<JWT> (SameSite=None; Secure)
    FE-->>User: ホーム画面表示
```

## 2. 配信開始フロー

```mermaid
sequenceDiagram
    actor User as 配信者
    participant FE as Next.js
    participant Rails as Rails API
    participant Bridge as Go ブリッジ
    participant YT as YouTube API

    User->>FE: 配信開始ボタン押下
    FE->>Rails: POST /stream_sessions { quality: "720p" }
    Rails->>Rails: QualityPreset.find_by(name, enabled:true)
    Rails->>YT: LiveBroadcasts.insert
    YT-->>Rails: broadcast_id
    Rails->>YT: LiveStreams.insert
    YT-->>Rails: stream_key, rtmp_url
    Rails->>YT: bind_broadcast_to_stream
    Rails->>Rails: StreamSession.create!
    Rails->>Rails: CollectStreamStatsJob.perform_in(30s)
    Rails-->>FE: { session_id, stream_key, rtmp_url }

    FE->>Bridge: POST /bridge/sessions { id, rtmp_url }
    Bridge->>Bridge: SessionStore.Register()
    Bridge-->>FE: 200 OK

    FE->>FE: getUserMedia / getDisplayMedia
    FE->>Bridge: WebSocket GET /ws?session_id=...
    Bridge->>Bridge: HandleWebSocket goroutine 起動
    Bridge->>Bridge: FFmpegRunner.Start(rtmp_url, stream_key)
    Bridge-->>FE: WS 接続確立

    FE->>Bridge: バイナリチャンク (MediaRecorder output)
    Bridge->>Bridge: FFmpeg stdin へ書き込み
    Bridge->>YT: RTMP ストリーム送信
```

## 3. 品質適応フロー

```mermaid
sequenceDiagram
    participant Bridge as Go ブリッジ
    participant QA as QualityAdapter
    participant FFmpeg as FFmpegProcess

    Bridge->>Bridge: PushStats受信 (fps, droppedFrames, bufferSizeKB)
    Bridge->>QA: Adapt(fps, droppedFrames, bufferSizeKB, now)
    QA->>QA: dropRate 計算（直近10秒）
    alt droppedFrames > 5%
        QA-->>Bridge: AdaptResult{ Action: downgrade, NewBitrate }
        Bridge->>Bridge: Session.SendRestart(params)
        Bridge->>FFmpeg: Stop()
        Bridge->>FFmpeg: Start(new params)
    else droppedFrames 0% が30秒継続
        QA-->>Bridge: AdaptResult{ Action: upgrade, NewBitrate }
        Bridge->>Bridge: Session.SendRestart(params)
        Bridge->>FFmpeg: Stop()
        Bridge->>FFmpeg: Start(new params)
    else 安定
        QA-->>Bridge: AdaptResult{ Action: stable }
    end
```

## 4. FFmpegクラッシュ自動再起動フロー

```mermaid
sequenceDiagram
    participant WS as HandleWebSocket
    participant Mon as monitorCrash goroutine
    participant FFmpeg as FFmpegProcess
    participant crashCh as crashCh

    WS->>FFmpeg: Start()
    WS->>Mon: go monitorCrash(gen=1, proc)
    Mon->>FFmpeg: <-proc.Done() (ブロック待機)
    FFmpeg--xMon: クラッシュ検知
    Mon->>crashCh: crashCh <- gen(1)
    WS->>WS: select { case gen := <-crashCh }
    alt gen == currentGen (有効なクラッシュ)
        WS->>WS: restartCount++
        alt restartCount <= MAX_RESTARTS(3)
            WS->>FFmpeg: 新プロセス Start()
            WS->>Mon: go monitorCrash(gen=2, newProc)
        else MAX超過
            WS->>WS: WS Close (1011 Internal Error)
        end
    else gen != currentGen (古い世代 = 品質変更による意図的停止)
        WS->>WS: continue (無視)
    end
```

## 5. セッション回復フロー

```mermaid
sequenceDiagram
    actor User as 配信者
    participant FE as Next.js
    participant Rails as Rails API
    participant YT as YouTube API

    Note over FE: WS 切断検知 (RECONNECTING state)
    FE->>Rails: POST /stream_sessions/:id/recover
    Rails->>YT: broadcast_status(broadcast_id)
    alt status が created/ready/liveStarting/live のいずれか
        Rails-->>FE: { recovered: true, new_broadcast: false, rtmp_url, broadcast_id }
        FE->>FE: 既存 rtmp_url で再接続
    else broadcast 無効
        Rails->>YT: create_broadcast + create_stream + bind
        Rails->>Rails: StreamSession.update!(新 broadcast_id, stream_key, rtmp_url)
        Rails-->>FE: { recovered: true, new_broadcast: true, rtmp_url, broadcast_id }
        FE->>FE: 新 rtmp_url で再接続
    end
```

## 6. 配信終了フロー

```mermaid
sequenceDiagram
    actor User as 配信者
    participant FE as Next.js
    participant Bridge as Go ブリッジ
    participant Rails as Rails API
    participant YT as YouTube API

    User->>FE: 配信停止ボタン押下
    FE->>Bridge: DELETE /bridge/sessions/:id
    Bridge->>Bridge: Session.Stop() → FFmpeg SIGTERM
    Bridge->>Bridge: SessionStore.Delete()
    Bridge-->>FE: 200 OK

    FE->>FE: MediaRecorder.stop() / WS.close()
    FE->>Rails: PATCH /stream_sessions/:id/end
    Rails->>YT: end_broadcast(broadcast_id)
    Rails->>Rails: StreamSession.update!(status: ended, ended_at: now)
    Rails-->>FE: session JSON
    FE-->>User: 配信終了表示 (COMPLETED state)
```

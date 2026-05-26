# クラス図（実装版）

## Rails API

```mermaid
classDiagram
    class User {
        +UUID id
        +String email
        +String name
        +String google_id
        +Text youtube_token
        +Text youtube_refresh_token
        +DateTime token_expiry
        +from_google(auth) User$
        +stream_sessions() StreamSession[]
    }

    class StreamSession {
        +UUID id
        +UUID user_id
        +String broadcast_id
        +Text stream_key
        +String rtmp_url
        +String status
        +String quality
        +DateTime started_at
        +DateTime ended_at
        +Integer duration_sec
        +Integer max_viewers
        +Text error_message
        +within_retention(days)$ Scope
        +stream_stats() StreamStat[]
        +user() User
    }

    class StreamStat {
        +UUID id
        +UUID stream_session_id
        +DateTime recorded_at
        +Integer bitrate_kbps
        +Decimal fps
        +Integer dropped_frames
        +Integer viewer_count
        +Integer buffer_size_kb
        +stream_session() StreamSession
    }

    class QualityPreset {
        +UUID id
        +String name
        +Integer width
        +Integer height
        +Integer fps
        +Integer bitrate
        +String codec
        +Boolean enabled
    }

    class StreamSessionsController {
        +index()
        +create()
        +end()
        +stats()
        +recover()
        -set_session()
        -history_json(session, max_viewers) Hash
        -session_json(session) Hash
        -stats_json(stat, session) Hash
        -recover_json(session, new_broadcast) Hash
    }

    User "1" --> "0..*" StreamSession : has_many
    StreamSession "1" --> "0..*" StreamStat : has_many
    StreamSessionsController --> StreamSession : uses
    StreamSessionsController --> StreamStat : uses
```

## Go ブリッジ

```mermaid
classDiagram
    class FFmpegProcess {
        <<interface>>
        +Write(b []byte) int, error
        +Close() error
        +Done() chan struct{}
        +Stop()
    }

    class FFmpegRunner {
        <<interface>>
        +Start(params FFmpegParams) FFmpegProcess, error
    }

    class RealFFmpegRunner {
        -path string
        +Start(params FFmpegParams) FFmpegProcess, error
    }

    class FFmpegParams {
        +RTMPURL string
        +StreamKey string
        +BitrateKbps int
        +Resolution string
    }

    class Session {
        +ID string
        +RTMPURL string
        -mu sync.Mutex
        -stopFunc func()
        -writeChan chan []byte
        -adapter QualityAdapter
        -restartCh chan QualityParams
        +SetStopFunc(f func())
        +Stop()
        +SetWriteChan(ch chan []byte)
        +Adapt(fps, droppedFrames, bufferSizeKB, now) AdaptResult
        +CurrentBitrate() int
        +SendRestart(params QualityParams) bool
        +RecvRestart() QualityParams, bool
        +TrySendStats(data []byte) bool
    }

    class SessionStore {
        -mu sync.RWMutex
        -sessions map string Session
        +NewSessionStore() SessionStore
        +Register(id, rtmpURL string) error
        +Get(id string) Session, error
        +Delete(id string)
    }

    class QualityAdapter {
        -history []statsEntry
        -currentBitrate int
        -currentResolution string
        +NewQualityAdapter(bitrateKbps, resolution) QualityAdapter
        +CurrentBitrate() int
        +CurrentResolution() string
        +Adapt(fps, droppedFrames, bufferSizeKB, now) AdaptResult
        -dropRate(now) float64
        -trimHistory(now)
    }

    class AdaptResult {
        +Action string
        +NewBitrate int
        +NewResolution string
    }

    class Handler {
        -store SessionStore
        -runner FFmpegRunner
        +RegisterSession(c gin.Context)
        +StopSession(c gin.Context)
        +HandleWebSocket(c gin.Context)
        +PushStats(c gin.Context)
        -adaptQuality(sess Session, body []byte)
    }

    RealFFmpegRunner ..|> FFmpegRunner
    Handler --> SessionStore : uses
    Handler --> FFmpegRunner : uses
    SessionStore --> Session : manages
    Session --> QualityAdapter : contains
    QualityAdapter --> AdaptResult : returns
```

## Next.js フロントエンド（主要 hooks / types）

```mermaid
classDiagram
    class StreamSessionState {
        <<union type>>
        IDLE
        CREATING
        CONNECTING
        STREAMING
        RECONNECTING
        ENDING
        COMPLETED
        ERROR
    }

    class useStreamSession {
        <<hook>>
        +startStream(config) Promise
        +reconnect(sessionId, attempt) Promise
        -onCrash(sessionId, attempt) Promise
    }

    class useStreamStats {
        <<hook>>
        +stats StreamStats
        +elapsed number
    }

    class useMixer {
        <<hook>>
        +mixerState MixerState
        +cameraStream MediaStream
        +screenStream MediaStream
        +outputStream MediaStream
    }

    class StreamHistoryTable {
        <<component>>
        +sessions StreamHistoryItem[]
        -formatDuration(sec) string
        -formatDateTime(iso) string
        -isSafeRecordingUrl(url) boolean
    }

    useStreamSession --> StreamSessionState : produces
    useStreamStats --> useStreamSession : depends on
```

class StreamSessionsController < ApplicationController
  before_action :authenticate!
  before_action :set_session, only: [ :end, :stats, :recover ]

  VALID_BROADCAST_STATUSES = %w[created ready testStarting liveStarting live].freeze
  DEFAULT_RETENTION_DAYS   = 7
  DEFAULT_PER_PAGE         = 20
  MAX_PER_PAGE             = 100

  def index
    retention_days = ENV.fetch("STREAM_HISTORY_RETENTION_DAYS", DEFAULT_RETENTION_DAYS).to_i
    page           = [ params[:page].to_i, 1 ].max
    per_page       = (params[:per_page].presence || DEFAULT_PER_PAGE).to_i.clamp(1, MAX_PER_PAGE)

    scope = @current_user.stream_sessions
                         .within_retention(retention_days)
                         .order(created_at: :desc, id: :desc)
    total_count = scope.count

    sessions = scope.limit(per_page).offset((page - 1) * per_page).to_a
    stats_map = StreamStat.where(stream_session_id: sessions.map(&:id))
                          .group(:stream_session_id)
                          .maximum(:viewer_count)

    render json: {
      sessions:    sessions.map { |s| history_json(s, stats_map[s.id]) },
      page:        page,
      per_page:    per_page,
      total_count: total_count,
      total_pages: (total_count.to_f / per_page).ceil
    }
  end

  def create
    youtube  = YoutubeService.new(@current_user)
    title    = "Live #{Time.current.strftime('%Y-%m-%d %H:%M')}"
    quality_name = session_params[:quality].presence || "720p"
    preset = QualityPreset.find_by(name: quality_name, enabled: true)
    unless preset
      render json: { error: "指定された品質は利用できません", code: "quality_not_available" },
             status: :unprocessable_entity
      return
    end

    broadcast = youtube.create_broadcast(title: title)
    stream    = youtube.create_stream(title: title)
    youtube.bind_broadcast_to_stream(broadcast_id: broadcast.id, stream_id: stream.id)

    session_record = StreamSession.create!(
      user:         @current_user,
      broadcast_id: broadcast.id,
      stream_key:   stream.cdn.ingestion_info.stream_name,
      rtmp_url:     stream.cdn.ingestion_info.ingestion_address,
      status:       "created",
      quality:      quality_name,
      started_at:   Time.current
    )

    CollectStreamStatsJob.perform_in(CollectStreamStatsJob::INTERVAL_SECONDS, session_record.id)

    render json: session_json(session_record), status: :created

  rescue YoutubeService::QuotaExceededError
    render json: { error: "YouTube API クォータが上限に達しました", code: "quota_exceeded" },
           status: :unprocessable_entity
  rescue YoutubeService::ChannelNotConfiguredError
    render json: { error: "YouTube チャンネルが設定されていません", code: "channel_not_configured" },
           status: :unprocessable_entity
  end

  def end
    if @stream_session.status == "ended"
      render json: { error: "セッションはすでに終了しています" }, status: :unprocessable_entity
      return
    end

    youtube = YoutubeService.new(@current_user)
    youtube.end_broadcast(broadcast_id: @stream_session.broadcast_id)

    @stream_session.update!(status: "ended", ended_at: Time.current)
    render json: session_json(@stream_session)

  rescue YoutubeService::QuotaExceededError
    render json: { error: "YouTube API クォータが上限に達しました", code: "quota_exceeded" },
           status: :unprocessable_entity
  end

  def stats
    stat = @stream_session.stream_stats.order(recorded_at: :desc).first
    return head :no_content if stat.nil?

    render json: stats_json(stat, @stream_session)
  end

  def recover
    youtube = YoutubeService.new(@current_user)
    status  = youtube.broadcast_status(broadcast_id: @stream_session.broadcast_id)

    if VALID_BROADCAST_STATUSES.include?(status)
      render json: recover_json(@stream_session, new_broadcast: false)
    else
      title     = "Live #{Time.current.strftime('%Y-%m-%d %H:%M')} (再接続)"
      broadcast = youtube.create_broadcast(title: title)
      stream    = youtube.create_stream(title: title)
      begin
        youtube.bind_broadcast_to_stream(broadcast_id: broadcast.id, stream_id: stream.id)
      rescue => e
        Rails.logger.warn "[recover] bind_broadcast_to_stream failed, orphaned: broadcast=#{broadcast.id} stream=#{stream.id}: #{e.message}"
        raise
      end

      @stream_session.update!(
        broadcast_id: broadcast.id,
        stream_key:   stream.cdn.ingestion_info.stream_name,
        rtmp_url:     stream.cdn.ingestion_info.ingestion_address,
        status:       "created"
      )

      render json: recover_json(@stream_session, new_broadcast: true)
    end
  rescue YoutubeService::QuotaExceededError
    render json: { error: "YouTube API クォータが上限に達しました", code: "quota_exceeded" },
           status: :unprocessable_entity
  rescue Google::Apis::Error => e
    Rails.logger.error "[recover] YouTube API error: #{e.message}"
    render json: { error: "YouTube API エラーが発生しました", code: "api_error" },
           status: :service_unavailable
  end

  private

  def set_session
    @stream_session = @current_user.stream_sessions.find_by(id: params[:id])
    render json: { error: "セッションが見つかりません" }, status: :not_found and return unless @stream_session
  end

  def session_params
    params.permit(:quality)
  end

  def session_json(session)
    {
      id:           session.id,
      broadcast_id: session.broadcast_id,
      rtmp_url:     session.rtmp_url,
      status:       session.status,
      quality:      session.quality,
      ended_at:     session.ended_at,
      created_at:   session.created_at
    }
  end

  def stats_json(stat, session)
    elapsed = session.started_at ? (Time.current - session.started_at).to_i : 0
    {
      id:              stat.id,
      recorded_at:     stat.recorded_at,
      bitrate_kbps:    stat.bitrate_kbps,
      fps:             stat.fps,
      dropped_frames:  stat.dropped_frames,
      viewer_count:    stat.viewer_count,
      buffer_size_kb:  stat.buffer_size_kb,
      elapsed_seconds: elapsed
    }
  end

  def recover_json(session, new_broadcast:)
    {
      recovered:     true,
      session_id:    session.id,
      rtmp_url:      session.rtmp_url,
      broadcast_id:  session.broadcast_id,
      new_broadcast: new_broadcast
    }
  end

  def history_json(session, max_viewers)
    duration = session.started_at && session.ended_at ? (session.ended_at - session.started_at).to_i : nil
    {
      id:            session.id,
      status:        session.status,
      quality:       session.quality,
      started_at:    session.started_at,
      ended_at:      session.ended_at,
      created_at:    session.created_at,
      duration_sec:  duration,
      max_viewers:   max_viewers,
      recording_url: nil
    }
  end
end

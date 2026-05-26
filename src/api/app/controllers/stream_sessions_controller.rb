class StreamSessionsController < ApplicationController
  before_action :authenticate!
  before_action :set_session, only: [:end, :stats]

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
end

class StreamSessionsController < ApplicationController
  before_action :authenticate!

  def create
    youtube  = YoutubeService.new(@current_user)
    title    = "Live #{Time.current.strftime('%Y-%m-%d %H:%M')}"
    quality  = session_params[:quality].presence || "720p"

    broadcast = youtube.create_broadcast(title: title)
    stream    = youtube.create_stream(title: title)
    youtube.bind_broadcast_to_stream(broadcast_id: broadcast.id, stream_id: stream.id)

    session_record = StreamSession.create!(
      user:         @current_user,
      broadcast_id: broadcast.id,
      stream_key:   stream.cdn.ingestion_info.stream_name,
      rtmp_url:     stream.cdn.ingestion_info.ingestion_address,
      status:       "created",
      quality:      quality
    )

    render json: session_json(session_record), status: :created

  rescue YoutubeService::QuotaExceededError
    render json: { error: "YouTube API クォータが上限に達しました", code: "quota_exceeded" },
           status: :unprocessable_entity
  rescue YoutubeService::ChannelNotConfiguredError
    render json: { error: "YouTube チャンネルが設定されていません", code: "channel_not_configured" },
           status: :unprocessable_entity
  end

  private

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
      created_at:   session.created_at
    }
  end
end

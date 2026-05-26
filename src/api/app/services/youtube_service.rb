require "google/apis/youtube_v3"

class YoutubeService
  class QuotaExceededError < StandardError; end
  class ChannelNotConfiguredError < StandardError; end

  BROADCAST_PARTS = "id,snippet,status"
  STREAM_PARTS    = "id,cdn"
  BIND_PARTS      = "id"

  def initialize(user, client: nil)
    @user   = user
    @client = client || build_client
  end

  def create_broadcast(title:, scheduled_start_time: Time.current)
    broadcast = Google::Apis::YoutubeV3::LiveBroadcast.new(
      snippet: Google::Apis::YoutubeV3::LiveBroadcastSnippet.new(
        title: title,
        scheduled_start_time: scheduled_start_time.iso8601
      ),
      status: Google::Apis::YoutubeV3::LiveBroadcastStatus.new(
        privacy_status: "private",
        self_declared_made_for_kids: false
      )
    )
    @client.insert_live_broadcast(BROADCAST_PARTS, broadcast)
  rescue Google::Apis::ClientError => e
    handle_client_error(e)
  end

  def create_stream(title:)
    stream = Google::Apis::YoutubeV3::LiveStream.new(
      snippet: Google::Apis::YoutubeV3::LiveStreamSnippet.new(title: title),
      cdn: Google::Apis::YoutubeV3::CdnSettings.new(
        frame_rate: "variable",
        ingestion_type: "rtmp",
        resolution: "variable"
      )
    )
    @client.insert_live_stream(STREAM_PARTS, stream)
  rescue Google::Apis::ClientError => e
    handle_client_error(e)
  end

  def bind_broadcast_to_stream(broadcast_id:, stream_id:)
    @client.bind_live_broadcast(broadcast_id, BIND_PARTS, stream_id: stream_id)
  rescue Google::Apis::ClientError => e
    handle_client_error(e)
  end

  private

  def build_client
    client = Google::Apis::YoutubeV3::YouTubeService.new
    client.authorization = build_authorization
    client
  end

  def build_authorization
    auth = Google::Auth::UserRefreshCredentials.new(
      client_id:     ENV.fetch("GOOGLE_CLIENT_ID"),
      client_secret: ENV.fetch("GOOGLE_CLIENT_SECRET"),
      access_token:  @user.youtube_token,
      refresh_token: @user.youtube_refresh_token,
      scope:         "https://www.googleapis.com/auth/youtube"
    )
    auth
  end

  def handle_client_error(error)
    reason = begin
      JSON.parse(error.body).dig("error", "errors", 0, "reason")
    rescue StandardError
      nil
    end
    quota = reason == "quotaExceeded" || error.message.include?("quotaExceeded")
    raise QuotaExceededError, error.message if quota
    raise ChannelNotConfiguredError, error.message if error.status_code == 404
    raise error
  end
end

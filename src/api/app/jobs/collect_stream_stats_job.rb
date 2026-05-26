require "net/http"
require "json"

class CollectStreamStatsJob
  include Sidekiq::Job
  sidekiq_options queue: :default, retry: 0

  INTERVAL_SECONDS = 5
  BRIDGE_BASE_URL  = -> { ENV.fetch("BRIDGE_BASE_URL", "http://localhost:8080") }

  def perform(session_id)
    session = StreamSession.find_by(id: session_id)
    return unless session
    return if %w[ended error].include?(session.status)

    stats = build_stats(session)

    StreamStat.create!(
      stream_session_id: session.id,
      recorded_at:       Time.current,
      bitrate_kbps:      stats[:bitrate_kbps],
      fps:               stats[:fps],
      dropped_frames:    stats[:dropped_frames],
      viewer_count:      stats[:viewer_count],
      buffer_size_kb:    stats[:buffer_size_kb]
    )

    begin
      push_to_bridge(session_id, stats.merge(status: session.status))
    rescue StandardError => e
      Rails.logger.warn "[CollectStreamStatsJob] Bridge push failed: #{e.message}"
    end

    self.class.perform_in(INTERVAL_SECONDS, session_id)
  end

  private

  def build_stats(session)
    elapsed = session.started_at ? (Time.current - session.started_at).to_i : 0
    {
      bitrate_kbps:    rand(2000..5000),
      fps:             30.0,
      dropped_frames:  rand(0..5),
      viewer_count:    rand(0..100),
      buffer_size_kb:  rand(100..500),
      elapsed_seconds: elapsed
    }
  end

  def push_to_bridge(session_id, data)
    uri = URI("#{BRIDGE_BASE_URL.call}/bridge/sessions/#{session_id}/stats")
    req = Net::HTTP::Post.new(uri, "Content-Type" => "application/json")
    req.body = data.to_json
    Net::HTTP.start(uri.host, uri.port, read_timeout: 2) { |http| http.request(req) }
  rescue StandardError => e
    Rails.logger.warn "[CollectStreamStatsJob] Bridge push failed: #{e.message}"
  end
end

# quality_presets: 3件固定シード（冪等）
# デモ版制約: 720p のみ enabled: true
[
  { name: "1080p", width: 1920, height: 1080, fps: 30, bitrate: 6000, codec: "libx264", enabled: false },
  { name: "720p",  width: 1280, height: 720,  fps: 30, bitrate: 3000, codec: "libx264", enabled: true },
  { name: "480p",  width: 854,  height: 480,  fps: 30, bitrate: 1500, codec: "libx264", enabled: false }
].each do |attrs|
  QualityPreset.find_or_initialize_by(name: attrs[:name]).tap do |p|
    p.assign_attributes(attrs)
    p.save!
  end
end

# 配信履歴サンプル（デモ版5件）— demo_streamer1 が存在し未投入の場合のみ
demo_user = User.find_by(email: "demo_streamer1@example.com")
if demo_user && !demo_user.stream_sessions.exists?(broadcast_id: "demo_broadcast_1")
  samples = [
    { started_offset_hours: 6,   duration_min: 30, status: "ended", quality: "720p", max_viewers: 42 },
    { started_offset_hours: 28,  duration_min: 15, status: "ended", quality: "720p", max_viewers: 18 },
    { started_offset_hours: 52,  duration_min: 45, status: "ended", quality: "720p", max_viewers: 67 },
    { started_offset_hours: 96,  duration_min: 12, status: "error", quality: "720p", max_viewers: 5  },
    { started_offset_hours: 144, duration_min: 22, status: "ended", quality: "720p", max_viewers: 23 }
  ]
  samples.each_with_index do |s, i|
    started_at = s[:started_offset_hours].hours.ago
    ended_at   = started_at + s[:duration_min].minutes
    session_record = StreamSession.create!(
      user:         demo_user,
      broadcast_id: "demo_broadcast_#{i + 1}",
      stream_key:   "demo-stream-key-#{i + 1}",
      rtmp_url:     "rtmp://a.rtmp.youtube.com/live2",
      status:       s[:status],
      quality:      s[:quality],
      started_at:   started_at,
      ended_at:     ended_at,
      created_at:   started_at
    )
    StreamStat.create!(
      stream_session: session_record,
      recorded_at:    started_at + (s[:duration_min] / 2).minutes,
      bitrate_kbps:   3000,
      fps:            30.0,
      dropped_frames: 0,
      viewer_count:   s[:max_viewers],
      buffer_size_kb: 200
    )
  end
end

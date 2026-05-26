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

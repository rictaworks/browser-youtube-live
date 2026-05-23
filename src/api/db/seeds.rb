# quality_presets: 4件固定シード（冪等）
[
  { name: '360p Standard',  width: 640,  height: 360,  fps: 30, bitrate: 800,  codec: 'libx264' },
  { name: '480p Standard',  width: 854,  height: 480,  fps: 30, bitrate: 1500, codec: 'libx264' },
  { name: '720p Standard',  width: 1280, height: 720,  fps: 30, bitrate: 3000, codec: 'libx264' },
  { name: '1080p Standard', width: 1920, height: 1080, fps: 30, bitrate: 6000, codec: 'libx264' }
].each do |attrs|
  QualityPreset.find_or_create_by!(name: attrs[:name]) do |p|
    p.width   = attrs[:width]
    p.height  = attrs[:height]
    p.fps     = attrs[:fps]
    p.bitrate = attrs[:bitrate]
    p.codec   = attrs[:codec]
  end
end

class QualityPresetsController < ApplicationController
  def index
    presets = QualityPreset.order(height: :desc)
    render json: presets.map { |p|
      {
        name:    p.name,
        width:   p.width,
        height:  p.height,
        fps:     p.fps,
        bitrate: p.bitrate,
        codec:   p.codec,
        enabled: p.enabled
      }
    }
  end
end

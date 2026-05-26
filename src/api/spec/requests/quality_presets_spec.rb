require "rails_helper"

RSpec.describe "GET /quality_presets", type: :request do
  let!(:preset_720) do
    QualityPreset.create!(name: "720p", width: 1280, height: 720, fps: 30, bitrate: 3000,
                          codec: "libx264", enabled: true)
  end
  let!(:preset_1080) do
    QualityPreset.create!(name: "1080p", width: 1920, height: 1080, fps: 30, bitrate: 6000,
                          codec: "libx264", enabled: false)
  end
  let!(:preset_480) do
    QualityPreset.create!(name: "480p", width: 854, height: 480, fps: 30, bitrate: 1500,
                          codec: "libx264", enabled: false)
  end

  it "200 と全プリセットを返す" do
    get "/quality_presets"
    expect(response).to have_http_status(:ok)
    json = JSON.parse(response.body)
    expect(json.length).to eq(3)
  end

  it "name / width / height / fps / bitrate / codec / enabled フィールドを含む" do
    get "/quality_presets"
    json = JSON.parse(response.body)
    preset = json.find { |p| p["name"] == "720p" }
    expect(preset).to include(
      "name"    => "720p",
      "width"   => 1280,
      "height"  => 720,
      "fps"     => 30,
      "bitrate" => 3000,
      "codec"   => "libx264",
      "enabled" => true
    )
  end

  it "height 降順（1080p → 720p → 480p）で返す" do
    get "/quality_presets"
    json = JSON.parse(response.body)
    heights = json.map { |p| p["height"] }
    expect(heights).to eq([ 1080, 720, 480 ])
  end

  it "認証なしでもアクセスできる" do
    get "/quality_presets"
    expect(response).not_to have_http_status(:unauthorized)
  end

  it "enabled: true のプリセットが正しく識別できる" do
    get "/quality_presets"
    json = JSON.parse(response.body)
    enabled_names = json.select { |p| p["enabled"] }.map { |p| p["name"] }
    expect(enabled_names).to eq([ "720p" ])
  end
end

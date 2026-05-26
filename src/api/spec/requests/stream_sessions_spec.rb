require "rails_helper"

RSpec.describe "POST /sessions", type: :request do
  include FactoryBot::Syntax::Methods

  let(:user) { create(:user) }
  let(:jwt_token) { JwtService.encode(user_id: user.id) }

  def auth_headers
    { "Cookie" => "jwt_token=#{jwt_token}" }
  end

  let(:mock_broadcast) do
    Google::Apis::YoutubeV3::LiveBroadcast.new(
      id: "broadcast_test_123",
      snippet: Google::Apis::YoutubeV3::LiveBroadcastSnippet.new(title: "テスト配信"),
      status: Google::Apis::YoutubeV3::LiveBroadcastStatus.new(life_cycle_status: "created")
    )
  end

  let(:mock_stream) do
    Google::Apis::YoutubeV3::LiveStream.new(
      id: "stream_test_456",
      cdn: Google::Apis::YoutubeV3::CdnSettings.new(
        ingestion_info: Google::Apis::YoutubeV3::IngestionInfo.new(
          stream_name: "key-test-abc",
          ingestion_address: "rtmp://a.rtmp.youtube.com/live2"
        )
      )
    )
  end

  before do
    allow_any_instance_of(YoutubeService).to receive(:create_broadcast).and_return(mock_broadcast)
    allow_any_instance_of(YoutubeService).to receive(:create_stream).and_return(mock_stream)
    allow_any_instance_of(YoutubeService).to receive(:bind_broadcast_to_stream).and_return(mock_broadcast)
  end

  context "認証済みユーザー" do
    it "セッションを作成して201を返す" do
      post "/sessions", params: { quality: "720p" }, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["broadcast_id"]).to eq("broadcast_test_123")
      expect(json["rtmp_url"]).to eq("rtmp://a.rtmp.youtube.com/live2")
      expect(json["status"]).to eq("created")
      expect(json["quality"]).to eq("720p")
    end

    it "DBにセッションが保存される" do
      expect {
        post "/sessions", params: { quality: "720p" }, headers: auth_headers
      }.to change(StreamSession, :count).by(1)
    end

    it "qualityを指定しない場合720pがデフォルトになる" do
      post "/sessions", params: {}, headers: auth_headers

      json = JSON.parse(response.body)
      expect(json["quality"]).to eq("720p")
    end
  end

  context "未認証" do
    it "401を返す" do
      post "/sessions", params: { quality: "720p" }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  context "YouTube APIクォータ超過" do
    before do
      allow_any_instance_of(YoutubeService).to receive(:create_broadcast)
        .and_raise(YoutubeService::QuotaExceededError)
    end

    it "422とエラーコードを返す" do
      post "/sessions", params: { quality: "720p" }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["code"]).to eq("quota_exceeded")
    end
  end

  context "YouTubeチャンネル未設定" do
    before do
      allow_any_instance_of(YoutubeService).to receive(:create_broadcast)
        .and_raise(YoutubeService::ChannelNotConfiguredError)
    end

    it "422とエラーコードを返す" do
      post "/sessions", params: { quality: "720p" }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["code"]).to eq("channel_not_configured")
    end
  end
end

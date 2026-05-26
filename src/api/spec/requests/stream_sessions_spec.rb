require "rails_helper"

RSpec.describe "POST /stream_sessions", type: :request do
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

  let!(:preset_720p) do
    QualityPreset.create!(name: "720p", width: 1280, height: 720, fps: 30, bitrate: 3000,
                          codec: "libx264", enabled: true)
  end

  before do
    allow_any_instance_of(YoutubeService).to receive(:create_broadcast).and_return(mock_broadcast)
    allow_any_instance_of(YoutubeService).to receive(:create_stream).and_return(mock_stream)
    allow_any_instance_of(YoutubeService).to receive(:bind_broadcast_to_stream).and_return(mock_broadcast)
  end

  context "認証済みユーザー" do
    it "セッションを作成して201を返す" do
      post "/stream_sessions", params: { quality: "720p" }, headers: auth_headers

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["broadcast_id"]).to eq("broadcast_test_123")
      expect(json["rtmp_url"]).to eq("rtmp://a.rtmp.youtube.com/live2")
      expect(json["status"]).to eq("created")
      expect(json["quality"]).to eq("720p")
    end

    it "DBにセッションが保存される" do
      expect {
        post "/stream_sessions", params: { quality: "720p" }, headers: auth_headers
      }.to change(StreamSession, :count).by(1)
    end

    it "qualityを指定しない場合720pがデフォルトになる" do
      post "/stream_sessions", params: {}, headers: auth_headers

      json = JSON.parse(response.body)
      expect(json["quality"]).to eq("720p")
    end
  end

  context "無効な品質（disabled）を指定した場合" do
    it "422 と quality_not_available コードを返す" do
      post "/stream_sessions", params: { quality: "1080p" }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["code"]).to eq("quality_not_available")
    end
  end

  context "存在しない品質名を指定した場合" do
    it "422 と quality_not_available コードを返す" do
      post "/stream_sessions", params: { quality: "4K" }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["code"]).to eq("quality_not_available")
    end
  end

  context "未認証" do
    it "401を返す" do
      post "/stream_sessions", params: { quality: "720p" }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  context "YouTube APIクォータ超過" do
    before do
      allow_any_instance_of(YoutubeService).to receive(:create_broadcast)
        .and_raise(YoutubeService::QuotaExceededError)
    end

    it "422とエラーコードを返す" do
      post "/stream_sessions", params: { quality: "720p" }, headers: auth_headers

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
      post "/stream_sessions", params: { quality: "720p" }, headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["code"]).to eq("channel_not_configured")
    end
  end
end

RSpec.describe "PATCH /stream_sessions/:id/end", type: :request do
  include FactoryBot::Syntax::Methods

  let(:user) { create(:user) }
  let(:jwt_token) { JwtService.encode(user_id: user.id) }

  def auth_headers
    { "Cookie" => "jwt_token=#{jwt_token}" }
  end

  before do
    allow_any_instance_of(YoutubeService).to receive(:end_broadcast).and_return(nil)
  end

  context "認証済み・自分の live セッション" do
    let(:session) { create(:stream_session, user: user, status: "live", broadcast_id: "broadcast_abc") }

    it "200 を返してステータスを ended に更新する" do
      patch "/stream_sessions/#{session.id}/end", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["status"]).to eq("ended")
    end

    it "ended_at が設定される" do
      patch "/stream_sessions/#{session.id}/end", headers: auth_headers

      expect(session.reload.ended_at).not_to be_nil
    end

    it "YoutubeService#end_broadcast を呼ぶ" do
      expect_any_instance_of(YoutubeService).to receive(:end_broadcast)
        .with(broadcast_id: "broadcast_abc")
      patch "/stream_sessions/#{session.id}/end", headers: auth_headers
    end
  end

  context "created ステータスのセッション（まだ配信開始前）" do
    let(:session) { create(:stream_session, user: user, status: "created") }

    it "200 を返してステータスを ended に更新する" do
      patch "/stream_sessions/#{session.id}/end", headers: auth_headers
      expect(response).to have_http_status(:ok)
      expect(session.reload.status).to eq("ended")
    end
  end

  context "すでに ended のセッション" do
    let(:session) { create(:stream_session, user: user, status: "ended") }

    it "422 を返す" do
      patch "/stream_sessions/#{session.id}/end", headers: auth_headers
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  context "他人のセッション" do
    let(:other_user) { create(:user) }
    let(:other_session) { create(:stream_session, user: other_user, status: "live") }

    it "404 を返す" do
      patch "/stream_sessions/#{other_session.id}/end", headers: auth_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  context "未認証" do
    let(:session) { create(:stream_session, user: user, status: "live") }

    it "401 を返す" do
      patch "/stream_sessions/#{session.id}/end"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  context "存在しないセッション" do
    it "404 を返す" do
      patch "/stream_sessions/#{SecureRandom.uuid}/end", headers: auth_headers
      expect(response).to have_http_status(:not_found)
    end
  end
end

RSpec.describe "GET /stream_sessions/:id/stats", type: :request do
  include FactoryBot::Syntax::Methods

  let(:user) { create(:user) }
  let(:jwt_token) { JwtService.encode(user_id: user.id) }

  def auth_headers
    { "Cookie" => "jwt_token=#{jwt_token}" }
  end

  let(:session) { create(:stream_session, user: user, status: "live") }

  context "統計データが存在する場合" do
    let!(:stat) do
      StreamStat.create!(
        stream_session: session,
        recorded_at: Time.current,
        bitrate_kbps: 3000,
        fps: 30.0,
        dropped_frames: 2,
        viewer_count: 42,
        buffer_size_kb: 256
      )
    end

    it "200 を返して最新の統計を返す" do
      get "/stream_sessions/#{session.id}/stats", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["bitrate_kbps"]).to eq(3000)
      expect(json["viewer_count"]).to eq(42)
      expect(json["fps"]).to eq("30.0")
      expect(json["elapsed_seconds"]).to be_a(Integer)
    end
  end

  context "統計データがまだない場合" do
    it "204 を返す" do
      get "/stream_sessions/#{session.id}/stats", headers: auth_headers
      expect(response).to have_http_status(:no_content)
    end
  end

  context "他人のセッション" do
    let(:other_user) { create(:user) }
    let(:other_session) { create(:stream_session, user: other_user, status: "live") }

    it "404 を返す" do
      get "/stream_sessions/#{other_session.id}/stats", headers: auth_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  context "未認証" do
    it "401 を返す" do
      get "/stream_sessions/#{session.id}/stats"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end

RSpec.describe "POST /stream_sessions/:id/recover", type: :request do
  include FactoryBot::Syntax::Methods

  let(:user) { create(:user) }
  let(:jwt_token) { JwtService.encode(user_id: user.id) }

  def auth_headers
    { "Cookie" => "jwt_token=#{jwt_token}" }
  end

  let(:session) { create(:stream_session, user: user, status: "live", broadcast_id: "bcast_abc") }

  let(:mock_broadcast_valid) do
    Google::Apis::YoutubeV3::LiveBroadcast.new(
      id: "bcast_abc",
      status: Google::Apis::YoutubeV3::LiveBroadcastStatus.new(life_cycle_status: "live")
    )
  end

  let(:mock_broadcast_invalid) do
    Google::Apis::YoutubeV3::LiveBroadcast.new(
      id: "bcast_abc",
      status: Google::Apis::YoutubeV3::LiveBroadcastStatus.new(life_cycle_status: "complete")
    )
  end

  let(:mock_broadcast_new) do
    Google::Apis::YoutubeV3::LiveBroadcast.new(
      id: "bcast_new_999",
      snippet: Google::Apis::YoutubeV3::LiveBroadcastSnippet.new(title: "再接続"),
      status: Google::Apis::YoutubeV3::LiveBroadcastStatus.new(life_cycle_status: "created")
    )
  end

  let(:mock_stream_new) do
    Google::Apis::YoutubeV3::LiveStream.new(
      id: "stream_new_456",
      cdn: Google::Apis::YoutubeV3::CdnSettings.new(
        ingestion_info: Google::Apis::YoutubeV3::IngestionInfo.new(
          stream_name: "key-new-abc",
          ingestion_address: "rtmp://a.rtmp.youtube.com/live2"
        )
      )
    )
  end

  context "有効なブロードキャストが存在する場合" do
    before do
      allow_any_instance_of(YoutubeService).to receive(:broadcast_status)
        .with(broadcast_id: "bcast_abc")
        .and_return("live")
    end

    it "200 を返して recovered=true と既存セッション情報を返す" do
      post "/stream_sessions/#{session.id}/recover", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["recovered"]).to be true
      expect(json["session_id"]).to eq(session.id)
      expect(json["rtmp_url"]).to eq(session.rtmp_url)
      expect(json["new_broadcast"]).to be false
    end
  end

  context "ブロードキャストが無効な場合（complete）" do
    before do
      allow_any_instance_of(YoutubeService).to receive(:broadcast_status)
        .with(broadcast_id: "bcast_abc")
        .and_return("complete")
      allow_any_instance_of(YoutubeService).to receive(:create_broadcast).and_return(mock_broadcast_new)
      allow_any_instance_of(YoutubeService).to receive(:create_stream).and_return(mock_stream_new)
      allow_any_instance_of(YoutubeService).to receive(:bind_broadcast_to_stream).and_return(mock_broadcast_new)
    end

    it "200 を返して recovered=true と new_broadcast=true を返す" do
      post "/stream_sessions/#{session.id}/recover", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["recovered"]).to be true
      expect(json["new_broadcast"]).to be true
      expect(json["broadcast_id"]).to eq("bcast_new_999")
    end

    it "セッションのbroadcast_idとrtmp_urlが更新される" do
      post "/stream_sessions/#{session.id}/recover", headers: auth_headers

      session.reload
      expect(session.broadcast_id).to eq("bcast_new_999")
      expect(session.rtmp_url).to eq("rtmp://a.rtmp.youtube.com/live2")
    end
  end

  context "createdステータスも有効なブロードキャストとして扱う" do
    before do
      allow_any_instance_of(YoutubeService).to receive(:broadcast_status)
        .and_return("created")
    end

    it "200 を返して new_broadcast=false" do
      post "/stream_sessions/#{session.id}/recover", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["new_broadcast"]).to be false
    end
  end

  context "存在しないセッション" do
    it "404 を返す" do
      post "/stream_sessions/#{SecureRandom.uuid}/recover", headers: auth_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  context "他人のセッション" do
    let(:other_user) { create(:user) }
    let(:other_session) { create(:stream_session, user: other_user, status: "live") }

    it "404 を返す" do
      post "/stream_sessions/#{other_session.id}/recover", headers: auth_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  context "未認証" do
    it "401 を返す" do
      post "/stream_sessions/#{session.id}/recover"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  context "YouTube APIクォータ超過" do
    before do
      allow_any_instance_of(YoutubeService).to receive(:broadcast_status)
        .and_return("complete")
      allow_any_instance_of(YoutubeService).to receive(:create_broadcast)
        .and_raise(YoutubeService::QuotaExceededError)
    end

    it "422 と quota_exceeded コードを返す" do
      post "/stream_sessions/#{session.id}/recover", headers: auth_headers

      expect(response).to have_http_status(:unprocessable_entity)
      json = JSON.parse(response.body)
      expect(json["code"]).to eq("quota_exceeded")
    end
  end
end

RSpec.describe "GET /stream_sessions", type: :request do
  include FactoryBot::Syntax::Methods

  let(:user) { create(:user) }
  let(:other_user) { create(:user) }
  let(:jwt_token) { JwtService.encode(user_id: user.id) }

  def auth_headers
    { "Cookie" => "jwt_token=#{jwt_token}" }
  end

  context "未認証" do
    it "401 を返す" do
      get "/stream_sessions"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  context "セッション 0 件の認証済みユーザー" do
    it "空配列とページネーション情報を返す" do
      get "/stream_sessions", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["sessions"]).to eq([])
      expect(json["total_count"]).to eq(0)
      expect(json["total_pages"]).to eq(0)
      expect(json["page"]).to eq(1)
    end
  end

  context "認証済みユーザー" do
    let!(:my_session_recent) do
      create(:stream_session, user: user, status: "ended",
             started_at: 2.hours.ago, ended_at: 1.hour.ago, created_at: 1.day.ago)
    end
    let!(:my_session_older) do
      create(:stream_session, user: user, status: "ended",
             started_at: 3.days.ago, ended_at: 3.days.ago + 30.minutes, created_at: 3.days.ago)
    end
    let!(:other_session) do
      create(:stream_session, user: other_user, status: "ended", created_at: 1.day.ago)
    end

    it "自分のセッションのみ返す" do
      get "/stream_sessions", headers: auth_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      ids = json["sessions"].map { |s| s["id"] }
      expect(ids).to contain_exactly(my_session_recent.id, my_session_older.id)
    end

    it "created_at 降順で返す" do
      get "/stream_sessions", headers: auth_headers

      json = JSON.parse(response.body)
      ids = json["sessions"].map { |s| s["id"] }
      expect(ids).to eq([ my_session_recent.id, my_session_older.id ])
    end

    it "各セッションに集計フィールドが含まれる" do
      create(:stream_stat, stream_session: my_session_recent, recorded_at: 90.minutes.ago,
             viewer_count: 5)
      create(:stream_stat, stream_session: my_session_recent, recorded_at: 80.minutes.ago,
             viewer_count: 12)

      get "/stream_sessions", headers: auth_headers

      json = JSON.parse(response.body)
      first = json["sessions"].find { |s| s["id"] == my_session_recent.id }
      expect(first["max_viewers"]).to eq(12)
      expect(first["duration_sec"]).to eq(3600)
      expect(first).to have_key("recording_url")
      expect(first["quality"]).to eq("720p")
      expect(first["status"]).to eq("ended")
      expect(first).to have_key("started_at")
    end

    it "stream_stats が無い場合 max_viewers は nil" do
      get "/stream_sessions", headers: auth_headers

      json = JSON.parse(response.body)
      first = json["sessions"].find { |s| s["id"] == my_session_recent.id }
      expect(first["max_viewers"]).to be_nil
    end

    it "ended_at が未設定なら duration_sec は nil" do
      live = create(:stream_session, user: user, status: "live",
                    started_at: 10.minutes.ago, ended_at: nil, created_at: 5.minutes.ago)

      get "/stream_sessions", headers: auth_headers

      json = JSON.parse(response.body)
      live_json = json["sessions"].find { |s| s["id"] == live.id }
      expect(live_json["duration_sec"]).to be_nil
    end
  end

  context "保持期間フィルタ" do
    before { ENV["STREAM_HISTORY_RETENTION_DAYS"] = "7" }
    after  { ENV.delete("STREAM_HISTORY_RETENTION_DAYS") }

    let!(:recent_session) { create(:stream_session, user: user, created_at: 3.days.ago) }
    let!(:expired_session) { create(:stream_session, user: user, created_at: 10.days.ago) }

    it "保持期間外のセッションは除外する" do
      get "/stream_sessions", headers: auth_headers

      json = JSON.parse(response.body)
      ids = json["sessions"].map { |s| s["id"] }
      expect(ids).to include(recent_session.id)
      expect(ids).not_to include(expired_session.id)
    end
  end

  context "ページネーション" do
    before do
      25.times do |i|
        create(:stream_session, user: user, created_at: (i + 1).hours.ago)
      end
    end

    it "デフォルトは20件返す" do
      get "/stream_sessions", headers: auth_headers

      json = JSON.parse(response.body)
      expect(json["sessions"].length).to eq(20)
      expect(json["page"]).to eq(1)
      expect(json["total_count"]).to eq(25)
      expect(json["total_pages"]).to eq(2)
    end

    it "page=2 で次ページを返す" do
      get "/stream_sessions", params: { page: 2 }, headers: auth_headers

      json = JSON.parse(response.body)
      expect(json["sessions"].length).to eq(5)
      expect(json["page"]).to eq(2)
    end

    it "per_page を制限する" do
      get "/stream_sessions", params: { per_page: 5 }, headers: auth_headers

      json = JSON.parse(response.body)
      expect(json["sessions"].length).to eq(5)
      expect(json["total_pages"]).to eq(5)
    end

    it "per_page の上限は100" do
      get "/stream_sessions", params: { per_page: 999 }, headers: auth_headers

      json = JSON.parse(response.body)
      expect(json["sessions"].length).to be <= 100
    end
  end
end

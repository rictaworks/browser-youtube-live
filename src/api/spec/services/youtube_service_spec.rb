require "rails_helper"

RSpec.describe YoutubeService, type: :service do
  let(:user) { build(:user) }
  let(:mock_yt_client) { instance_double(Google::Apis::YoutubeV3::YouTubeService) }
  subject(:service) { described_class.new(user, client: mock_yt_client) }

  describe "#create_broadcast" do
    let(:broadcast_response) do
      Google::Apis::YoutubeV3::LiveBroadcast.new(
        id: "broadcast_abc",
        snippet: Google::Apis::YoutubeV3::LiveBroadcastSnippet.new(title: "テスト配信"),
        status: Google::Apis::YoutubeV3::LiveBroadcastStatus.new(life_cycle_status: "created")
      )
    end

    it "YouTube LiveBroadcasts.insert を呼び出してIDを返す" do
      allow(mock_yt_client).to receive(:insert_live_broadcast)
        .with("id,snippet,status", anything)
        .and_return(broadcast_response)

      result = service.create_broadcast(title: "テスト配信")
      expect(result.id).to eq("broadcast_abc")
    end

    context "クォータ超過時" do
      it "QuotaExceededError を発生させる" do
        allow(mock_yt_client).to receive(:insert_live_broadcast)
          .and_raise(Google::Apis::ClientError.new("quotaExceeded", status_code: 403))

        expect { service.create_broadcast(title: "テスト") }
          .to raise_error(YoutubeService::QuotaExceededError)
      end
    end

    context "チャンネル未設定時" do
      it "ChannelNotConfiguredError を発生させる" do
        allow(mock_yt_client).to receive(:insert_live_broadcast)
          .and_raise(Google::Apis::ClientError.new("channelNotFound", status_code: 404))

        expect { service.create_broadcast(title: "テスト") }
          .to raise_error(YoutubeService::ChannelNotConfiguredError)
      end
    end
  end

  describe "#create_stream" do
    let(:stream_response) do
      Google::Apis::YoutubeV3::LiveStream.new(
        id: "stream_xyz",
        cdn: Google::Apis::YoutubeV3::CdnSettings.new(
          ingestion_info: Google::Apis::YoutubeV3::IngestionInfo.new(
            stream_name: "key-abc123",
            ingestion_address: "rtmp://a.rtmp.youtube.com/live2"
          )
        )
      )
    end

    it "YouTube LiveStreams.insert を呼び出してストリーム情報を返す" do
      allow(mock_yt_client).to receive(:insert_live_stream)
        .with("id,cdn", anything)
        .and_return(stream_response)

      result = service.create_stream(title: "テスト配信")
      expect(result.id).to eq("stream_xyz")
      expect(result.cdn.ingestion_info.stream_name).to eq("key-abc123")
    end
  end

  describe "#bind_broadcast_to_stream" do
    let(:bind_response) do
      Google::Apis::YoutubeV3::LiveBroadcast.new(id: "broadcast_abc")
    end

    it "LiveBroadcasts.bind を呼び出す" do
      allow(mock_yt_client).to receive(:bind_live_broadcast)
        .with("broadcast_abc", "id", stream_id: "stream_xyz")
        .and_return(bind_response)

      result = service.bind_broadcast_to_stream(broadcast_id: "broadcast_abc", stream_id: "stream_xyz")
      expect(result.id).to eq("broadcast_abc")
    end
  end
end

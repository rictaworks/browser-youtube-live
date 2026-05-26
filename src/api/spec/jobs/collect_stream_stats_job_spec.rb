require "rails_helper"
require "sidekiq/testing"

RSpec.describe CollectStreamStatsJob, type: :job do
  include FactoryBot::Syntax::Methods

  let(:user) { create(:user) }
  let(:session) do
    StreamSession.create!(
      user: user,
      broadcast_id: "broadcast_123",
      stream_key: "key-abc",
      rtmp_url: "rtmp://a.rtmp.youtube.com/live2/key-abc",
      status: "created",
      quality: "720p",
      started_at: Time.current
    )
  end

  before { Sidekiq::Worker.clear_all }

  let(:job) { described_class.new }

  before do
    allow(job).to receive(:push_to_bridge)
  end

  describe "#perform" do
    it "stream_statレコードを作成する" do
      expect {
        job.perform(session.id)
      }.to change(StreamStat, :count).by(1)
    end

    it "作成したstream_statに recorded_at が設定される" do
      job.perform(session.id)

      stat = StreamStat.last
      expect(stat.recorded_at).to be_present
      expect(stat.stream_session_id).to eq(session.id)
    end

    it "push_to_bridge を呼ぶ" do
      expect(job).to receive(:push_to_bridge).with(session.id, hash_including(:bitrate_kbps, :viewer_count))
      job.perform(session.id)
    end

    it "次回ジョブをキューに追加する" do
      job.perform(session.id)
      expect(described_class.jobs.size).to eq(1)
    end

    context "セッションが存在しない場合" do
      it "何もせずに終了する" do
        expect {
          job.perform("non-existent-id")
        }.not_to change(StreamStat, :count)
      end
    end

    context "セッションがendedの場合" do
      before { session.update!(status: "ended") }

      it "統計を収集せずに終了する" do
        expect {
          job.perform(session.id)
        }.not_to change(StreamStat, :count)
      end

      it "次回ジョブをキューに追加しない" do
        job.perform(session.id)
        expect(described_class.jobs.size).to eq(0)
      end
    end

    context "セッションがerrorの場合" do
      before { session.update!(status: "error") }

      it "統計を収集せずに終了する" do
        expect {
          job.perform(session.id)
        }.not_to change(StreamStat, :count)
      end
    end

    context "Bridge HTTP呼び出しが失敗しても" do
      before do
        allow(job).to receive(:push_to_bridge).and_raise(Errno::ECONNREFUSED)
      end

      it "例外を発生させずstream_statは作成される" do
        expect {
          job.perform(session.id)
        }.not_to raise_error

        expect(StreamStat.count).to eq(1)
      end
    end
  end
end

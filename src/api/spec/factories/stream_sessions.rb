FactoryBot.define do
  factory :stream_session do
    association :user
    sequence(:broadcast_id) { |n| "broadcast_#{n}" }
    stream_key { "stream-key-abc123" }
    rtmp_url { "rtmp://a.rtmp.youtube.com/live2" }
    status { "created" }
    quality { "720p" }
  end
end

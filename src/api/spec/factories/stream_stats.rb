FactoryBot.define do
  factory :stream_stat do
    association :stream_session
    recorded_at { Time.current }
    bitrate_kbps { 3000 }
    fps { 30.0 }
    dropped_frames { 0 }
    viewer_count { 0 }
    buffer_size_kb { 100 }
  end
end

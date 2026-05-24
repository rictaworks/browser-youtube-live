class StreamStat < ApplicationRecord
  belongs_to :stream_session

  validates :recorded_at, presence: true
end

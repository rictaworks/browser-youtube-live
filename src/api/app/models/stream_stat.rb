class StreamStat < ApplicationRecord
  before_create { self.id ||= SecureRandom.uuid }

  belongs_to :stream_session

  validates :recorded_at, presence: true
end

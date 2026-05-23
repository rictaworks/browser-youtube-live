class StreamSession < ApplicationRecord
  STATUSES  = %w[created starting live ended error].freeze
  QUALITIES = %w[360p 480p 720p 1080p].freeze

  belongs_to :user
  has_many :stream_stats, foreign_key: :stream_session_id, dependent: :destroy

  encrypts :stream_key

  validates :status,  presence: true, inclusion: { in: STATUSES }
  validates :quality, presence: true, inclusion: { in: QUALITIES }
end

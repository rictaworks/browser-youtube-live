class User < ApplicationRecord
  has_many :stream_sessions, dependent: :destroy

  encrypts :youtube_token

  validates :email,     presence: true, uniqueness: true,
                        format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name,      presence: true
  validates :google_id, presence: true, uniqueness: true
end

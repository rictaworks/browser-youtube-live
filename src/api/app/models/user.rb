class User < ApplicationRecord
  before_create { self.id ||= SecureRandom.uuid }

  has_many :stream_sessions, dependent: :destroy

  encrypts :youtube_token
  encrypts :youtube_refresh_token

  validates :email,     presence: true, uniqueness: true,
                        format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name,      presence: true
  validates :google_id, presence: true, uniqueness: true

  def self.from_google(auth)
    user = find_or_initialize_by(google_id: auth.uid)
    attrs = {
      email:         auth.info.email,
      name:          auth.info.name,
      youtube_token: auth.credentials.token,
      token_expiry:  Time.at(auth.credentials.expires_at)
    }
    attrs[:youtube_refresh_token] = auth.credentials.refresh_token if auth.credentials.refresh_token.present?
    user.assign_attributes(attrs)
    user.save!
    user
  end
end

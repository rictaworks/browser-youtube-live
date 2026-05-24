class User < ApplicationRecord
  has_many :stream_sessions, dependent: :destroy

  encrypts :youtube_token

  validates :email,     presence: true, uniqueness: true,
                        format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name,      presence: true
  validates :google_id, presence: true, uniqueness: true

  def self.from_google(auth)
    user = find_or_initialize_by(google_id: auth.uid)
    user.assign_attributes(
      email:         auth.info.email,
      name:          auth.info.name,
      youtube_token: auth.credentials.token,
      token_expiry:  Time.at(auth.credentials.expires_at)
    )
    user.save!
    user
  end
end

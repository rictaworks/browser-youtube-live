FactoryBot.define do
  factory :user do
    id { SecureRandom.uuid }
    sequence(:email) { |n| "user#{n}@example.com" }
    name { "Test User" }
    sequence(:google_id) { |n| "google_#{n}" }
    youtube_token { "ya29.test_access_token" }
    youtube_refresh_token { "1//test_refresh_token" }
    token_expiry { 1.hour.from_now }
  end
end

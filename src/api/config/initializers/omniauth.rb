client_id     = ENV.fetch("GOOGLE_CLIENT_ID")     { raise "GOOGLE_CLIENT_ID が設定されていません" }
client_secret = ENV.fetch("GOOGLE_CLIENT_SECRET") { raise "GOOGLE_CLIENT_SECRET が設定されていません" }

Rails.application.config.middleware.use OmniAuth::Builder do
  provider :google_oauth2, client_id, client_secret, {
    scope: "email,profile,https://www.googleapis.com/auth/youtube",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true
  }
end

OmniAuth.config.allowed_request_methods = [ :post, :get ]
OmniAuth.config.silence_get_warning = true

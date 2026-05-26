Devise.setup do |config|
  jwt_secret = ENV.fetch("DEVISE_JWT_SECRET_KEY") { raise "DEVISE_JWT_SECRET_KEY が設定されていません" }

  config.jwt do |jwt|
    jwt.secret = jwt_secret
    jwt.dispatch_requests = [
      [ "POST", %r{^/auth/sign_in$} ]
    ]
    jwt.revocation_requests = [
      [ "DELETE", %r{^/auth/sign_out$} ]
    ]
    jwt.expiration_time = 1.day.to_i
  end

  config.mailer_sender = "no-reply@example.com"
  config.case_insensitive_keys = [ :email ]
  config.strip_whitespace_keys = [ :email ]
  config.skip_session_storage = [ :http_auth ]
  config.stretches = Rails.env.test? ? 1 : 12
  config.reconfirmable = false
  config.expire_all_remember_me_on_sign_out = true
  config.password_length = 6..128
  config.email_regexp = /\A[^@\s]+@[^@\s]+\z/
  config.reset_password_within = 6.hours
  config.sign_out_via = :delete
end

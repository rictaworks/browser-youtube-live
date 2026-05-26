require "jwt"

module JwtService
  ALGORITHM = "HS256"
  TTL       = 24 * 60 * 60

  def self.encode(payload)
    secret  = ENV.fetch("DEVISE_JWT_SECRET_KEY") { raise "DEVISE_JWT_SECRET_KEY が設定されていません" }
    exp     = Time.now.to_i + TTL
    JWT.encode(payload.merge(exp: exp), secret, ALGORITHM)
  end

  def self.decode(token)
    secret  = ENV.fetch("DEVISE_JWT_SECRET_KEY") { raise "DEVISE_JWT_SECRET_KEY が設定されていません" }
    payload = JWT.decode(token, secret, true, { algorithm: ALGORITHM }).first
    HashWithIndifferentAccess.new(payload)
  rescue JWT::ExpiredSignature
    raise JWT::ExpiredSignature, "トークンの有効期限が切れています"
  rescue JWT::DecodeError => e
    raise JWT::DecodeError, "トークンが無効です: #{e.message}"
  end
end

# Be sure to restart your server when you modify this file.

# 本番では FRONTEND_ORIGIN を必須にする（フォールバック禁止）
# 開発のみ localhost:3000 をデフォルト許可
frontend_origin =
  if Rails.env.production?
    ENV.fetch("FRONTEND_ORIGIN") do
      raise "FRONTEND_ORIGIN environment variable is required in production"
    end
  else
    ENV.fetch("FRONTEND_ORIGIN", "http://localhost:3000")
  end

Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins frontend_origin

    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      credentials: true
  end
end

class ApplicationController < ActionController::API
  include ActionController::Cookies

  JWT_COOKIE_NAME = "jwt_token"
  JWT_COOKIE_TTL  = 24 * 60 * 60

  before_action :verify_csrf_origin!, if: -> { request.post? || request.patch? || request.put? || request.delete? }

  private

  # SameSite=None cookie を使うため、CORS preflight を回避できる simple request による
  # CSRF を防止する。Origin ヘッダーが存在する場合のみ検証し、サーバー間リクエストは通過させる。
  def verify_csrf_origin!
    origin = request.headers["Origin"]
    return unless origin

    allowed =
      if Rails.env.production?
        ENV.fetch("FRONTEND_ORIGIN") { raise "FRONTEND_ORIGIN が設定されていません" }
      else
        ENV.fetch("FRONTEND_ORIGIN", "http://localhost:3000")
      end

    unless origin == allowed
      render json: { error: "リクエスト元が許可されていません" }, status: :forbidden
    end
  end

  def authenticate!
    token = cookies[JWT_COOKIE_NAME]

    unless token
      render json: { error: "認証が必要です" }, status: :unauthorized
      return
    end

    payload       = JwtService.decode(token)
    @current_user = User.find(payload[:user_id])
  rescue JWT::ExpiredSignature
    render json: { error: "セッションの有効期限が切れています。再ログインしてください。" }, status: :unauthorized
  rescue JWT::DecodeError
    render json: { error: "認証トークンが無効です" }, status: :unauthorized
  rescue ActiveRecord::RecordNotFound
    render json: { error: "ユーザーが見つかりません" }, status: :unauthorized
  end
end

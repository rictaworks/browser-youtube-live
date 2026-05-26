class ApplicationController < ActionController::API
  include ActionController::Cookies

  JWT_COOKIE_NAME = "jwt_token"
  JWT_COOKIE_TTL  = 24 * 60 * 60

  private

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

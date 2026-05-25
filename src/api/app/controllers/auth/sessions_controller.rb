module Auth
  class SessionsController < ApplicationController
    before_action :authenticate!, only: [:me]

    def me
      render json: {
        id:    @current_user.id,
        email: @current_user.email,
        name:  @current_user.name
      }
    end

    def destroy
      cookies.delete(JWT_COOKIE_NAME)
      head :no_content
    end

    private

    def authenticate!
      token = cookies[JWT_COOKIE_NAME]

      unless token
        render json: { error: '認証が必要です' }, status: :unauthorized
        return
      end

      payload       = JwtService.decode(token)
      @current_user = User.find(payload[:user_id])
    rescue JWT::ExpiredSignature
      render json: { error: 'セッションの有効期限が切れています。再ログインしてください。' }, status: :unauthorized
    rescue JWT::DecodeError
      render json: { error: '認証トークンが無効です' }, status: :unauthorized
    rescue ActiveRecord::RecordNotFound
      render json: { error: 'ユーザーが見つかりません' }, status: :unauthorized
    end
  end
end

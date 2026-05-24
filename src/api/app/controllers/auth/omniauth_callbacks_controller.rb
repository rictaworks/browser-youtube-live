module Auth
  class OmniauthCallbacksController < ApplicationController
    skip_before_action :verify_authenticity_token, raise: false

    def google_oauth2
      auth = request.env['omniauth.auth']

      unless auth
        render json: { error: 'OAuth 認証情報が取得できませんでした' }, status: :unauthorized
        return
      end

      user  = User.from_google(auth)
      token = JwtService.encode(user_id: user.id)

      cookies[JWT_COOKIE_NAME] = {
        value:     token,
        httponly:  true,
        secure:    Rails.env.production?,
        same_site: :none,
        expires:   JWT_COOKIE_TTL.seconds.from_now
      }

      redirect_to "#{frontend_origin}/", allow_other_host: true
    rescue ActiveRecord::RecordInvalid => e
      Rails.logger.error("OAuth ユーザー保存失敗: #{e.message}")
      render json: { error: 'ユーザー情報の保存に失敗しました' }, status: :unprocessable_entity
    end

    private

    def frontend_origin
      ENV.fetch("FRONTEND_ORIGIN") { raise "FRONTEND_ORIGIN が設定されていません" }
    end
  end
end

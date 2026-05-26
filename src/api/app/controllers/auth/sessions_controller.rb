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
  end
end

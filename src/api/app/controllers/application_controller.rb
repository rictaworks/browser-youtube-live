class ApplicationController < ActionController::API
  JWT_COOKIE_NAME = 'jwt_token'
  JWT_COOKIE_TTL  = 24 * 60 * 60
end

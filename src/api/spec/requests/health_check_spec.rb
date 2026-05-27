require 'rails_helper'

RSpec.describe 'Application middleware stack', type: :request do
  it 'includes CookieStore so OmniAuth can use session in API mode' do
    middleware_names = Rails.application.middleware.map(&:name)
    expect(middleware_names).to include('ActionDispatch::Session::CookieStore')
  end

  it 'GET /up returns 200 without session error' do
    get '/up'
    expect(response).to have_http_status(:ok)
  end
end

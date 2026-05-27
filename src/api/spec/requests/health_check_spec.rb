require 'rails_helper'

RSpec.describe 'Application middleware stack', type: :request do
  it 'includes CookieStore so OmniAuth can use session in API mode' do
    middleware_names = Rails.application.middleware.map(&:name)
    expect(middleware_names).to include('ActionDispatch::Session::CookieStore')
  end
end

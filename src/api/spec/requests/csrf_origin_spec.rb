require 'rails_helper'

RSpec.describe 'CSRF Origin 検証', type: :request do
  let(:user) { create(:user) }
  let(:token) { JwtService.encode(user_id: user.id) }
  let(:cookie_header) { "#{ApplicationController::JWT_COOKIE_NAME}=#{token}" }

  describe 'POST /stream_sessions' do
    it '許可された Origin からのリクエストは 403 以外を返す' do
      post '/stream_sessions',
           params: { quality: '720p' },
           headers: { 'Origin' => 'http://localhost:3000', 'Cookie' => cookie_header }
      expect(response).not_to have_http_status(:forbidden)
    end

    it '不正な Origin からのリクエストは 403 を返す' do
      post '/stream_sessions',
           params: { quality: '720p' },
           headers: { 'Origin' => 'https://attacker.example.com', 'Cookie' => cookie_header }
      expect(response).to have_http_status(:forbidden)
    end

    it 'Origin ヘッダーがない場合（サーバー間リクエスト）は 403 にならない' do
      post '/stream_sessions',
           params: { quality: '720p' },
           headers: { 'Cookie' => cookie_header }
      expect(response).not_to have_http_status(:forbidden)
    end
  end
end

require 'minitest/autorun'
require 'open3'

API_ROOT      = File.expand_path('../../src/api',      __dir__)
FRONTEND_ROOT = File.expand_path('../../src/frontend', __dir__)

class OauthTest < Minitest::Test
  TEST_ENV = {
    'RAILS_ENV'                         => 'test',
    'AR_ENCRYPTION_PRIMARY_KEY'         => 'test_primary_key_32chars_padded!',
    'AR_ENCRYPTION_DETERMINISTIC_KEY'   => 'test_deterministic_32chars_pads!',
    'AR_ENCRYPTION_KEY_DERIVATION_SALT' => 'test_derivation_salt_value_here!',
    'GOOGLE_CLIENT_ID'                  => 'test_google_client_id',
    'GOOGLE_CLIENT_SECRET'              => 'test_google_client_secret',
    'DEVISE_JWT_SECRET_KEY'             => 'test_jwt_secret_key_32chars_pads!'
  }

  def rails(cmd)
    out, status = Open3.capture2e(TEST_ENV, "bundle exec rails #{cmd}", chdir: API_ROOT)
    [out, status.success?]
  end

  # ---- Gemfile ----

  def test_gemfile_has_omniauth
    content = File.read(File.join(API_ROOT, 'Gemfile'))
    assert content.include?('omniauth'), "Gemfile に omniauth がない"
  end

  def test_gemfile_has_omniauth_google_oauth2
    content = File.read(File.join(API_ROOT, 'Gemfile'))
    assert content.include?('omniauth-google-oauth2'), "Gemfile に omniauth-google-oauth2 がない"
  end

  def test_gemfile_has_omniauth_rails_csrf_protection
    content = File.read(File.join(API_ROOT, 'Gemfile'))
    assert content.include?('omniauth-rails_csrf_protection'), "Gemfile に omniauth-rails_csrf_protection がない"
  end

  # ---- Initializers ----

  def test_devise_initializer_exists
    assert File.exist?(File.join(API_ROOT, 'config/initializers/devise.rb')),
           "config/initializers/devise.rb が存在しない"
  end

  def test_omniauth_initializer_exists
    assert File.exist?(File.join(API_ROOT, 'config/initializers/omniauth.rb')),
           "config/initializers/omniauth.rb が存在しない"
  end

  def test_devise_initializer_references_jwt_secret
    content = File.read(File.join(API_ROOT, 'config/initializers/devise.rb'))
    assert content.include?('DEVISE_JWT_SECRET_KEY'), "devise.rb に DEVISE_JWT_SECRET_KEY の参照がない"
  end

  def test_omniauth_initializer_references_google_client_id
    content = File.read(File.join(API_ROOT, 'config/initializers/omniauth.rb'))
    assert content.include?('GOOGLE_CLIENT_ID'), "omniauth.rb に GOOGLE_CLIENT_ID の参照がない"
  end

  def test_omniauth_initializer_references_google_client_secret
    content = File.read(File.join(API_ROOT, 'config/initializers/omniauth.rb'))
    assert content.include?('GOOGLE_CLIENT_SECRET'), "omniauth.rb に GOOGLE_CLIENT_SECRET の参照がない"
  end

  def test_omniauth_initializer_uses_env_fetch
    content = File.read(File.join(API_ROOT, 'config/initializers/omniauth.rb'))
    assert content.include?('ENV.fetch'), "omniauth.rb が ENV.fetch を使っていない（フォールバック禁止）"
  end

  # ---- User モデル ----

  def test_user_model_has_from_google_method
    content = File.read(File.join(API_ROOT, 'app/models/user.rb'))
    assert content.include?('from_google'), "User モデルに from_google メソッドがない"
  end

  def test_user_model_has_youtube_scope
    content = File.read(File.join(API_ROOT, 'app/models/user.rb'))
    assert content.include?('youtube'), "User モデルに youtube スコープ/カラム参照がない"
  end

  # ---- サービス ----

  def test_jwt_service_exists
    assert File.exist?(File.join(API_ROOT, 'app/services/jwt_service.rb')),
           "app/services/jwt_service.rb が存在しない"
  end

  def test_jwt_service_has_encode
    content = File.read(File.join(API_ROOT, 'app/services/jwt_service.rb'))
    assert content.include?('encode'), "JwtService に encode メソッドがない"
  end

  def test_jwt_service_has_decode
    content = File.read(File.join(API_ROOT, 'app/services/jwt_service.rb'))
    assert content.include?('decode'), "JwtService に decode メソッドがない"
  end

  def test_jwt_service_uses_env_fetch_for_secret
    content = File.read(File.join(API_ROOT, 'app/services/jwt_service.rb'))
    assert content.include?('DEVISE_JWT_SECRET_KEY'), "JwtService が DEVISE_JWT_SECRET_KEY を参照していない"
  end

  # ---- コントローラー ----

  def test_omniauth_callbacks_controller_exists
    assert File.exist?(File.join(API_ROOT, 'app/controllers/auth/omniauth_callbacks_controller.rb')),
           "auth/omniauth_callbacks_controller.rb が存在しない"
  end

  def test_omniauth_callbacks_controller_has_google_action
    content = File.read(File.join(API_ROOT, 'app/controllers/auth/omniauth_callbacks_controller.rb'))
    assert content.include?('google_oauth2'), "OmniauthCallbacksController に google_oauth2 アクションがない"
  end

  def test_omniauth_callbacks_controller_sets_http_only_cookie
    content = File.read(File.join(API_ROOT, 'app/controllers/auth/omniauth_callbacks_controller.rb'))
    assert content.include?('httponly') || content.include?('http_only'),
           "OmniauthCallbacksController が httpOnly Cookie を設定していない"
  end

  def test_sessions_controller_exists
    assert File.exist?(File.join(API_ROOT, 'app/controllers/auth/sessions_controller.rb')),
           "auth/sessions_controller.rb が存在しない"
  end

  def test_sessions_controller_has_me_action
    content = File.read(File.join(API_ROOT, 'app/controllers/auth/sessions_controller.rb'))
    assert content.include?('def me'), "SessionsController に me アクションがない"
  end

  def test_sessions_controller_has_destroy_action
    content = File.read(File.join(API_ROOT, 'app/controllers/auth/sessions_controller.rb'))
    assert content.include?('def destroy'), "SessionsController に destroy アクションがない"
  end

  def test_sessions_controller_destroy_clears_cookie
    content = File.read(File.join(API_ROOT, 'app/controllers/auth/sessions_controller.rb'))
    assert content.include?('delete') || content.include?('cookies'),
           "SessionsController#destroy が Cookie を削除していない"
  end

  # ---- ルーティング ----

  def test_routes_has_auth_google
    content = File.read(File.join(API_ROOT, 'config/routes.rb'))
    assert content.include?('omniauth') || content.include?('/auth/google'),
           "routes.rb に /auth/google エンドポイントがない"
  end

  def test_routes_has_auth_me
    content = File.read(File.join(API_ROOT, 'config/routes.rb'))
    assert content.include?('me'), "routes.rb に /auth/me エンドポイントがない"
  end

  # ---- .env.example ----

  def test_env_example_has_google_client_id
    content = File.read(File.join(API_ROOT, '.env.example'))
    assert content.include?('GOOGLE_CLIENT_ID'), ".env.example に GOOGLE_CLIENT_ID がない"
  end

  def test_env_example_has_google_client_secret
    content = File.read(File.join(API_ROOT, '.env.example'))
    assert content.include?('GOOGLE_CLIENT_SECRET'), ".env.example に GOOGLE_CLIENT_SECRET がない"
  end

  def test_env_example_has_devise_jwt_secret_key
    content = File.read(File.join(API_ROOT, '.env.example'))
    assert content.include?('DEVISE_JWT_SECRET_KEY'), ".env.example に DEVISE_JWT_SECRET_KEY がない"
  end

  # ---- フロントエンド ----

  def test_login_button_component_exists
    assert File.exist?(File.join(FRONTEND_ROOT, 'src/components/LoginButton.tsx')),
           "src/components/LoginButton.tsx が存在しない"
  end

  def test_login_button_uses_google_icon
    content = File.read(File.join(FRONTEND_ROOT, 'src/components/LoginButton.tsx'))
    assert content.include?('google') || content.include?('faGoogle'),
           "LoginButton に Google アイコン（faGoogle）がない"
  end

  def test_login_button_links_to_auth_google
    content = File.read(File.join(FRONTEND_ROOT, 'src/components/LoginButton.tsx'))
    assert content.include?('/auth/google'), "LoginButton に /auth/google リンクがない"
  end

  def test_use_current_user_hook_exists
    assert File.exist?(File.join(FRONTEND_ROOT, 'src/hooks/useCurrentUser.ts')),
           "src/hooks/useCurrentUser.ts が存在しない"
  end

  def test_use_current_user_hook_calls_auth_me
    content = File.read(File.join(FRONTEND_ROOT, 'src/hooks/useCurrentUser.ts'))
    assert content.include?('/auth/me'), "useCurrentUser が /auth/me を呼んでいない"
  end

  def test_use_current_user_hook_uses_credentials_include
    content = File.read(File.join(FRONTEND_ROOT, 'src/hooks/useCurrentUser.ts'))
    assert content.include?('credentials') && content.include?('include'),
           "useCurrentUser が credentials: 'include' を指定していない（Cookie 送信に必要）"
  end

  def test_page_uses_login_button
    content = File.read(File.join(FRONTEND_ROOT, 'src/app/page.tsx'))
    assert content.include?('LoginButton'), "page.tsx が LoginButton を使っていない"
  end

  def test_page_uses_use_current_user
    content = File.read(File.join(FRONTEND_ROOT, 'src/app/page.tsx'))
    assert content.include?('useCurrentUser'), "page.tsx が useCurrentUser を使っていない"
  end

  # ---- ハードコード禁止チェック ----

  def test_no_hardcoded_client_id_in_initializer
    content = File.read(File.join(API_ROOT, 'config/initializers/omniauth.rb'))
    refute content.match?(/client_id\s*[=:]\s*['"][0-9a-zA-Z_\-\.]+\.apps\.googleusercontent\.com['"]/),
           "omniauth.rb に Google Client ID がハードコードされている"
  end

  def test_no_hardcoded_jwt_secret_in_service
    content = File.read(File.join(API_ROOT, 'app/services/jwt_service.rb'))
    refute content.match?(/secret\s*[=:]\s*['"][a-zA-Z0-9+\/=]{20,}['"]/),
           "JwtService に JWT シークレットがハードコードされている"
  end
end

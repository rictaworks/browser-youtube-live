#!/usr/bin/env ruby
# PR #2 — Rails 7 API サーバー初期構築テスト
# 対象: src/api/
# 実行: ruby test/pr002/rails_setup_test.rb

require 'minitest/autorun'
require 'net/http'
require 'json'

API_ROOT = File.expand_path('../../src/api', __dir__)

class RailsSetupTest < Minitest::Test
  # ── ディレクトリ・ファイル存在確認 ──────────────────────────

  def test_api_directory_exists
    assert Dir.exist?(API_ROOT), "src/api/ が存在しない"
  end

  def test_gemfile_exists
    assert File.exist?(File.join(API_ROOT, 'Gemfile')), "src/api/Gemfile が存在しない"
  end

  def test_gemfile_includes_devise
    gemfile = File.read(File.join(API_ROOT, 'Gemfile'))
    assert gemfile.include?("'devise'") || gemfile.include?('"devise"'),
           "Gemfile に devise がない"
  end

  def test_gemfile_includes_devise_jwt
    gemfile = File.read(File.join(API_ROOT, 'Gemfile'))
    assert gemfile.include?("'devise-jwt'") || gemfile.include?('"devise-jwt"'),
           "Gemfile に devise-jwt がない"
  end

  def test_gemfile_includes_google_api_client
    gemfile = File.read(File.join(API_ROOT, 'Gemfile'))
    assert gemfile.include?("'google-api-client'") || gemfile.include?('"google-api-client"'),
           "Gemfile に google-api-client がない"
  end

  def test_gemfile_includes_pg
    gemfile = File.read(File.join(API_ROOT, 'Gemfile'))
    assert gemfile.include?("'pg'") || gemfile.include?('"pg"'),
           "Gemfile に pg がない"
  end

  def test_gemfile_includes_sidekiq
    gemfile = File.read(File.join(API_ROOT, 'Gemfile'))
    assert gemfile.include?("'sidekiq'") || gemfile.include?('"sidekiq"'),
           "Gemfile に sidekiq がない"
  end

  def test_gemfile_includes_rack_cors
    gemfile = File.read(File.join(API_ROOT, 'Gemfile'))
    assert gemfile.include?("'rack-cors'") || gemfile.include?('"rack-cors"'),
           "Gemfile に rack-cors がない"
  end

  def test_gemfile_includes_rspec_rails
    gemfile = File.read(File.join(API_ROOT, 'Gemfile'))
    assert gemfile.include?("'rspec-rails'") || gemfile.include?('"rspec-rails"'),
           "Gemfile に rspec-rails がない"
  end

  # ── ハードコード検出 ──────────────────────────────────────

  def test_cors_config_no_hardcoded_wildcard
    cors_path = File.join(API_ROOT, 'config/initializers/cors.rb')
    assert File.exist?(cors_path), "config/initializers/cors.rb が存在しない"
    content = File.read(cors_path)
    refute content.match?(/origins\s+['"]?\*['"]?/), "CORS に * ワイルドカードがハードコードされている"
  end

  def test_cors_uses_env_variable
    cors_path = File.join(API_ROOT, 'config/initializers/cors.rb')
    content = File.read(cors_path)
    uses_env = content.include?('ENV[') || content.include?('ENV.fetch')
    assert uses_env, "CORS の origins が環境変数を使っていない"
  end

  # ── Rails API モード確認 ──────────────────────────────────

  def test_application_is_api_only
    app_path = File.join(API_ROOT, 'config/application.rb')
    assert File.exist?(app_path), "config/application.rb が存在しない"
    content = File.read(app_path)
    assert content.match?(/config\.api_only\s*=\s*true/), "API only モードが設定されていない"
  end

  # ── RSpec 設定確認 ────────────────────────────────────────

  def test_rspec_spec_directory_exists
    assert Dir.exist?(File.join(API_ROOT, 'spec')), "src/api/spec/ が存在しない"
  end

  def test_rspec_helper_exists
    assert File.exist?(File.join(API_ROOT, 'spec/rails_helper.rb')), "spec/rails_helper.rb が存在しない"
  end

  # ── データベース設定確認 ──────────────────────────────────

  def test_database_yml_exists
    assert File.exist?(File.join(API_ROOT, 'config/database.yml')), "config/database.yml が存在しない"
  end

  def test_database_yml_dev_uses_sqlite3
    db_config = File.read(File.join(API_ROOT, 'config/database.yml'))
    assert db_config.downcase.include?('sqlite3'), "development DB が sqlite3 でない"
  end

  def test_database_yml_prod_uses_postgresql
    db_config = File.read(File.join(API_ROOT, 'config/database.yml'))
    has_pg = db_config.downcase.include?('postgresql') || db_config.include?('DATABASE_URL')
    assert has_pg, "production DB が postgresql / DATABASE_URL でない"
  end

  # ── ポート設定確認 ────────────────────────────────────────

  def test_puma_config_port_4000
    puma_path = File.join(API_ROOT, 'config/puma.rb')
    assert File.exist?(puma_path), "config/puma.rb が存在しない"
    content = File.read(puma_path)
    has_port = content.include?('4000') || content.include?('PORT')
    assert has_port, "puma.rb にポート 4000 または PORT 環境変数の設定がない"
  end
end

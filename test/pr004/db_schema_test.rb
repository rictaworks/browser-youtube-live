require 'minitest/autorun'
require 'open3'

API_ROOT = File.expand_path('../../src/api', __dir__)

class DbSchemaTest < Minitest::Test
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

  def migration_file(pattern)
    Dir.glob(File.join(API_ROOT, 'db', 'migrate', "*_#{pattern}.rb")).first
  end

  # ---- マイグレーションファイル存在確認 ----

  def test_users_migration_exists
    assert migration_file('create_users'), "users マイグレーションファイルが存在しない"
  end

  def test_stream_sessions_migration_exists
    assert migration_file('create_stream_sessions'), "stream_sessions マイグレーションファイルが存在しない"
  end

  def test_stream_stats_migration_exists
    assert migration_file('create_stream_stats'), "stream_stats マイグレーションファイルが存在しない"
  end

  def test_quality_presets_migration_exists
    assert migration_file('create_quality_presets'), "quality_presets マイグレーションファイルが存在しない"
  end

  # ---- マイグレーション内容確認 ----

  def test_users_has_uuid_primary_key
    content = File.read(migration_file('create_users'))
    assert content.include?(':uuid'), "users に UUID 主キーがない"
  end

  def test_users_has_required_columns
    content = File.read(migration_file('create_users'))
    %w[email name google_id youtube_token token_expiry].each do |col|
      assert content.include?(col), "users に #{col} カラムがない"
    end
  end

  def test_stream_sessions_has_uuid_primary_key
    content = File.read(migration_file('create_stream_sessions'))
    assert content.include?(':uuid'), "stream_sessions に UUID 主キーがない"
  end

  def test_stream_sessions_has_user_foreign_key
    content = File.read(migration_file('create_stream_sessions'))
    assert content.include?('user'), "stream_sessions に user 外部キーがない"
  end

  def test_stream_sessions_stream_key_is_text
    content = File.read(migration_file('create_stream_sessions'))
    assert content.match?(/text.*stream_key|stream_key.*text/), "stream_sessions の stream_key が text 型でない"
  end

  def test_stream_sessions_has_required_columns
    content = File.read(migration_file('create_stream_sessions'))
    %w[status quality broadcast_id rtmp_url started_at ended_at duration_sec max_viewers error_message].each do |col|
      assert content.include?(col), "stream_sessions に #{col} カラムがない"
    end
  end

  def test_stream_stats_has_required_columns
    content = File.read(migration_file('create_stream_stats'))
    %w[stream_session recorded_at bitrate_kbps fps dropped_frames viewer_count buffer_size_kb].each do |col|
      assert content.include?(col), "stream_stats に #{col} カラムがない"
    end
  end

  def test_quality_presets_has_required_columns
    content = File.read(migration_file('create_quality_presets'))
    %w[name width height fps bitrate codec].each do |col|
      assert content.include?(col), "quality_presets に #{col} カラムがない"
    end
  end

  # ---- モデルファイル存在確認 ----

  def test_user_model_exists
    assert File.exist?(File.join(API_ROOT, 'app/models/user.rb')), "User モデルが存在しない"
  end

  def test_stream_session_model_exists
    assert File.exist?(File.join(API_ROOT, 'app/models/stream_session.rb')), "StreamSession モデルが存在しない"
  end

  def test_stream_stat_model_exists
    assert File.exist?(File.join(API_ROOT, 'app/models/stream_stat.rb')), "StreamStat モデルが存在しない"
  end

  def test_quality_preset_model_exists
    assert File.exist?(File.join(API_ROOT, 'app/models/quality_preset.rb')), "QualityPreset モデルが存在しない"
  end

  # ---- モデル内容確認 ----

  def test_user_has_many_stream_sessions
    content = File.read(File.join(API_ROOT, 'app/models/user.rb'))
    assert content.include?('has_many :stream_sessions'), "User に has_many :stream_sessions がない"
  end

  def test_stream_session_belongs_to_user
    content = File.read(File.join(API_ROOT, 'app/models/stream_session.rb'))
    assert content.include?('belongs_to :user'), "StreamSession に belongs_to :user がない"
  end

  def test_stream_session_has_many_stream_stats
    content = File.read(File.join(API_ROOT, 'app/models/stream_session.rb'))
    assert content.include?('has_many :stream_stats'), "StreamSession に has_many :stream_stats がない"
  end

  def test_stream_stat_belongs_to_stream_session
    content = File.read(File.join(API_ROOT, 'app/models/stream_stat.rb'))
    assert content.include?('belongs_to :stream_session'), "StreamStat に belongs_to :stream_session がない"
  end

  def test_stream_session_encrypts_stream_key
    content = File.read(File.join(API_ROOT, 'app/models/stream_session.rb'))
    assert content.include?('encrypts :stream_key'), "StreamSession に encrypts :stream_key がない"
  end

  def test_stream_session_status_enum_values
    content = File.read(File.join(API_ROOT, 'app/models/stream_session.rb'))
    %w[created starting live ended error].each do |status|
      assert content.include?(status), "StreamSession STATUSES に #{status} がない"
    end
  end

  def test_stream_session_quality_enum_values
    content = File.read(File.join(API_ROOT, 'app/models/stream_session.rb'))
    %w[360p 480p 720p 1080p].each do |q|
      assert content.include?(q), "StreamSession QUALITIES に #{q} がない"
    end
  end

  # ---- セキュリティ確認 ----

  def test_encryption_initializer_exists
    assert File.exist?(File.join(API_ROOT, 'config/initializers/active_record_encryption.rb')),
           "config/initializers/active_record_encryption.rb が存在しない"
  end

  def test_encryption_key_uses_env_fetch
    content = File.read(File.join(API_ROOT, 'config/initializers/active_record_encryption.rb'))
    assert content.include?('AR_ENCRYPTION_PRIMARY_KEY'), "暗号化設定に AR_ENCRYPTION_PRIMARY_KEY がない"
    assert content.include?('AR_ENCRYPTION_DETERMINISTIC_KEY'), "暗号化設定に AR_ENCRYPTION_DETERMINISTIC_KEY がない"
    assert content.include?('AR_ENCRYPTION_KEY_DERIVATION_SALT'), "暗号化設定に AR_ENCRYPTION_KEY_DERIVATION_SALT がない"
  end

  def test_encryption_key_no_hardcode
    content = File.read(File.join(API_ROOT, 'config/initializers/active_record_encryption.rb'))
    refute content.match?(/primary_key\s*=\s*['"][a-zA-Z0-9]{8,}/),
           "暗号化キーがハードコードされている"
  end

  def test_env_example_has_encryption_keys
    content = File.read(File.join(API_ROOT, '.env.example'))
    assert content.include?('AR_ENCRYPTION_PRIMARY_KEY'), ".env.example に AR_ENCRYPTION_PRIMARY_KEY がない"
    assert content.include?('AR_ENCRYPTION_DETERMINISTIC_KEY'), ".env.example に AR_ENCRYPTION_DETERMINISTIC_KEY がない"
    assert content.include?('AR_ENCRYPTION_KEY_DERIVATION_SALT'), ".env.example に AR_ENCRYPTION_KEY_DERIVATION_SALT がない"
  end

  # ---- seeds 内容確認 ----

  def test_seeds_has_quality_presets
    content = File.read(File.join(API_ROOT, 'db/seeds.rb'))
    assert content.include?('QualityPreset'), "seeds.rb に QualityPreset の投入がない"
  end

  def test_seeds_has_four_quality_presets
    content = File.read(File.join(API_ROOT, 'db/seeds.rb'))
    %w[360p 480p 720p 1080p].each do |q|
      assert content.include?(q), "seeds.rb に #{q} プリセットがない"
    end
  end

  # ---- db:migrate 実行確認 ----

  def test_db_migrate_succeeds
    out, success = rails('db:migrate')
    assert success, "db:migrate に失敗:\n#{out}"
  end

  def test_schema_has_all_tables
    rails('db:migrate')
    structure = File.read(File.join(API_ROOT, 'db/structure.sql'))
    %w[users stream_sessions stream_stats quality_presets].each do |table|
      assert structure.include?(table), "structure.sql に #{table} テーブルがない"
    end
  end

  # ---- seeds 実行確認 ----

  def test_seeds_create_four_quality_presets
    rails('db:migrate')
    rails('db:seed')
    out, success = rails('runner "puts QualityPreset.count"')
    assert success, "rails runner に失敗:\n#{out}"
    count = out.strip.lines.last.to_i
    assert_equal 4, count, "quality_presets のシード数が4件でない（#{count}件）"
  end
end

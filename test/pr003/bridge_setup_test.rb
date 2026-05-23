require 'minitest/autorun'
require 'net/http'
require 'json'
require 'uri'

BRIDGE_ROOT = File.expand_path('../../src/bridge', __dir__)

class BridgeSetupTest < Minitest::Test
  # --- ディレクトリ・ファイル存在確認 ---

  def test_bridge_directory_exists
    assert Dir.exist?(BRIDGE_ROOT), "src/bridge/ が存在しない"
  end

  def test_go_mod_exists
    assert File.exist?(File.join(BRIDGE_ROOT, 'go.mod')), "go.mod が存在しない"
  end

  def test_go_sum_exists
    assert File.exist?(File.join(BRIDGE_ROOT, 'go.sum')), "go.sum が存在しない"
  end

  def test_main_go_exists
    assert File.exist?(File.join(BRIDGE_ROOT, 'main.go')), "main.go が存在しない"
  end

  def test_env_example_exists
    assert File.exist?(File.join(BRIDGE_ROOT, '.env.example')), ".env.example が存在しない"
  end

  # --- go.mod 内容確認 ---

  def test_go_mod_module_name
    content = File.read(File.join(BRIDGE_ROOT, 'go.mod'))
    assert content.include?('module'), "go.mod に module 宣言がない"
  end

  def test_go_mod_gin_dependency
    content = File.read(File.join(BRIDGE_ROOT, 'go.mod'))
    assert content.include?('gin-gonic/gin'), "go.mod に gin-gonic/gin が含まれていない"
  end

  def test_go_mod_gorilla_websocket_dependency
    content = File.read(File.join(BRIDGE_ROOT, 'go.mod'))
    assert content.include?('gorilla/websocket'), "go.mod に gorilla/websocket が含まれていない"
  end

  def test_go_mod_godotenv_dependency
    content = File.read(File.join(BRIDGE_ROOT, 'go.mod'))
    assert content.include?('godotenv') || content.include?('joho'), "go.mod に godotenv が含まれていない"
  end

  # --- main.go 内容確認 ---

  def test_main_go_uses_gin
    content = File.read(File.join(BRIDGE_ROOT, 'main.go'))
    assert content.include?('gin-gonic/gin') || content.include?('"github.com/gin-gonic/gin"'),
           "main.go に gin のインポートがない"
  end

  def test_main_go_uses_gorilla_websocket
    content = File.read(File.join(BRIDGE_ROOT, 'main.go'))
    assert content.include?('gorilla/websocket'), "main.go に gorilla/websocket のインポートがない"
  end

  def test_main_go_health_endpoint
    content = File.read(File.join(BRIDGE_ROOT, 'main.go'))
    assert content.include?('/health'), "main.go に /health エンドポイントがない"
  end

  def test_main_go_reads_port_env
    content = File.read(File.join(BRIDGE_ROOT, 'main.go'))
    assert content.include?('PORT'), "main.go に PORT 環境変数の参照がない"
  end

  def test_main_go_reads_ffmpeg_path_env
    content = File.read(File.join(BRIDGE_ROOT, 'main.go'))
    assert content.include?('FFMPEG_PATH'), "main.go に FFMPEG_PATH 環境変数の参照がない"
  end

  def test_main_go_no_hardcoded_port
    content = File.read(File.join(BRIDGE_ROOT, 'main.go'))
    refute content.match?(/:8080["'`]/), "ポート番号 8080 がハードコードされている"
  end

  def test_main_go_no_hardcoded_ffmpeg_path
    content = File.read(File.join(BRIDGE_ROOT, 'main.go'))
    refute content.match?(%r{['"]/usr/bin/ffmpeg['"]}), "FFmpegパスがハードコードされている"
  end

  # --- .env.example 内容確認 ---

  def test_env_example_has_port
    content = File.read(File.join(BRIDGE_ROOT, '.env.example'))
    assert content.include?('PORT'), ".env.example に PORT がない"
  end

  def test_env_example_has_ffmpeg_path
    content = File.read(File.join(BRIDGE_ROOT, '.env.example'))
    assert content.include?('FFMPEG_PATH'), ".env.example に FFMPEG_PATH がない"
  end

  # --- ビルド確認 ---

  def test_go_build_succeeds
    output = `cd #{BRIDGE_ROOT} && go build ./... 2>&1`
    assert $?.success?, "go build に失敗: #{output}"
  end

  # --- ヘルスチェック疎通確認 ---

  def test_health_endpoint_returns_ok
    pid = spawn("cd #{BRIDGE_ROOT} && PORT=18080 FFMPEG_PATH=/usr/bin/ffmpeg ./bridge",
                out: '/dev/null', err: '/dev/null')
    sleep 1.5

    begin
      uri = URI.parse('http://localhost:18080/health')
      res = Net::HTTP.get_response(uri)
      assert_equal '200', res.code, "/health が 200 を返さない (#{res.code})"

      body = JSON.parse(res.body)
      assert_equal 'ok', body['status'], "レスポンス body に status:ok がない"
    ensure
      Process.kill('TERM', pid)
      Process.wait(pid)
    end
  end
end

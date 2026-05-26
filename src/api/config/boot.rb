ENV["BUNDLE_GEMFILE"] ||= File.expand_path("../Gemfile", __dir__)

require "bundler/setup" # Set up gems listed in the Gemfile.
require "bootsnap/setup" # Speed up boot time by caching expensive operations.

# リポジトリルートの .env を読み込む（src/api/ から 2 階層上）
root_env = File.expand_path("../../../.env", __dir__)
require "dotenv"
Dotenv.load(root_env) if File.exist?(root_env)

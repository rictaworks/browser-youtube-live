primary_key = ENV.fetch("STREAM_KEY_ENCRYPTION_KEY") { raise "STREAM_KEY_ENCRYPTION_KEY が設定されていません" }
salt        = ENV.fetch("STREAM_KEY_DERIVATION_SALT") { raise "STREAM_KEY_DERIVATION_SALT が設定されていません" }

Rails.application.config.active_record.encryption.primary_key       = primary_key
Rails.application.config.active_record.encryption.deterministic_key = primary_key
Rails.application.config.active_record.encryption.key_derivation_salt = salt

primary_key     = ENV.fetch("AR_ENCRYPTION_PRIMARY_KEY")     { raise "AR_ENCRYPTION_PRIMARY_KEY が設定されていません" }
deterministic   = ENV.fetch("AR_ENCRYPTION_DETERMINISTIC_KEY") { raise "AR_ENCRYPTION_DETERMINISTIC_KEY が設定されていません" }
salt            = ENV.fetch("AR_ENCRYPTION_KEY_DERIVATION_SALT") { raise "AR_ENCRYPTION_KEY_DERIVATION_SALT が設定されていません" }

Rails.application.config.active_record.encryption.primary_key        = primary_key
Rails.application.config.active_record.encryption.deterministic_key  = deterministic
Rails.application.config.active_record.encryption.key_derivation_salt = salt

package main

import "testing"

func TestValidateRTMPURL(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantErr bool
	}{
		// 正常系
		{"YouTube rtmp", "rtmp://a.rtmp.youtube.com/live2/key-abc", false},
		{"YouTube rtmps", "rtmps://a.rtmps.youtube.com/live2/key-abc", false},
		{"YouTube backup", "rtmp://b.rtmp.youtube.com/live2/key-abc", false},

		// 攻撃ペイロード — file スキームによる任意ファイル書き込み
		{"file scheme", "file:///etc/cron.d/pwn", true},
		// SSRF
		{"http scheme", "http://internal-host:8080/admin", true},
		{"https scheme", "https://internal-host/", true},
		{"tcp scheme", "tcp://internal:9000", true},
		{"udp scheme", "udp://internal:9000", true},

		// ホスト偽装
		{"非 YouTube ホスト", "rtmp://attacker.example.com/live/leak", true},
		{"YouTube サブドメイン偽装", "rtmp://a.rtmp.youtube.com.attacker.com/live", true},
		{"空ホスト", "rtmp:///live2/key", true},

		// 制御文字
		{"改行混入", "rtmp://a.rtmp.youtube.com/live2\n/key", true},
		{"NUL 混入", "rtmp://a.rtmp.youtube.com/\x00key", true},

		// その他
		{"空文字", "", true},
		{"スキームなし", "a.rtmp.youtube.com/live2/key", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateRTMPURL(tt.url)
			if tt.wantErr && err == nil {
				t.Fatalf("expected error for %q, got nil", tt.url)
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("expected no error for %q, got %v", tt.url, err)
			}
		})
	}
}

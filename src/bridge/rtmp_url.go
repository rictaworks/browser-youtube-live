package main

import (
	"errors"
	"net/url"
	"strings"
)

var ErrInvalidRTMPURL = errors.New("invalid rtmp_url")

// YouTube Live のインジェスト先のみを許可する allowlist
var allowedRTMPHostSuffixes = []string{
	".rtmp.youtube.com",
	".rtmps.youtube.com",
}

// ValidateRTMPURL は信頼できる YouTube RTMP インジェスト URL のみを通す
// FFmpeg の出力先にユーザー入力をそのまま渡すと file:/http:/tcp: 等で
// 任意ファイル書き込み・SSRF が成立するため、スキームとホストを厳格に検証する
func ValidateRTMPURL(raw string) error {
	if raw == "" {
		return ErrInvalidRTMPURL
	}
	// 制御文字（CR/LF/NUL 含む）を含む URL は拒否
	for _, r := range raw {
		if r < 0x20 || r == 0x7f {
			return ErrInvalidRTMPURL
		}
	}

	u, err := url.Parse(raw)
	if err != nil {
		return ErrInvalidRTMPURL
	}

	scheme := strings.ToLower(u.Scheme)
	if scheme != "rtmp" && scheme != "rtmps" {
		return ErrInvalidRTMPURL
	}

	host := strings.ToLower(u.Hostname())
	if host == "" {
		return ErrInvalidRTMPURL
	}
	for _, suffix := range allowedRTMPHostSuffixes {
		if strings.HasSuffix(host, suffix) {
			return nil
		}
	}
	return ErrInvalidRTMPURL
}

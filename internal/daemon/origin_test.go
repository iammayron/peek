package daemon

import (
	"testing"

	peek "github.com/iammayron/peek"
)

func TestAllowedOrigin(t *testing.T) {
	cases := []struct {
		origin string
		want   bool
	}{
		{"", true}, // non-browser callers (curl, the CLI) send no Origin
		{"chrome-extension://" + peek.ExtensionID, true},
		{"chrome-extension://" + peek.StoreExtensionID, true},
		{"chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", false},
		{"https://evil.example", false},
	}
	for _, c := range cases {
		if got := allowedOrigin(c.origin); got != c.want {
			t.Errorf("allowedOrigin(%q) = %v, want %v", c.origin, got, c.want)
		}
	}
}

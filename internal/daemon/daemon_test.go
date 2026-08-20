package daemon

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/iammayron/inspectai/internal/paths"
	"github.com/iammayron/inspectai/internal/rpc"
)

func TestPinLatestRoundTrip(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("INSPECTAI_HOME", dir)
	if err := paths.EnsureHome(); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go func() { _ = Serve(ctx) }()

	deadline := time.Now().Add(2 * time.Second)
	var c *rpc.Client
	var err error
	for time.Now().Before(deadline) {
		c, err = rpc.Dial(200 * time.Millisecond)
		if err == nil {
			break
		}
		time.Sleep(30 * time.Millisecond)
	}
	if err != nil {
		t.Fatalf("dial: %v", err)
	}
	defer c.Close()

	png := base64.StdEncoding.EncodeToString([]byte{0x89, 'P', 'N', 'G'})
	payload, _ := json.Marshal(map[string]any{
		"url":      "https://example.com/billing",
		"title":    "Billing",
		"selector": "[data-testid=\"save-billing\"]",
		"strategy": "data-testid",
		"xpath":    "//*[@data-testid='save-billing']",
		"tag":      "button",
		"name":     "Save changes",
		"rect":     map[string]any{"x": 10, "y": 20, "w": 120, "h": 40, "vw": 1280, "vh": 720, "dpr": 2},
	})
	resp, err := c.Call("pin", rpc.PinParams{Payload: payload, PngBase64: png, MIME: "image/png"}, 2*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if resp.Pin == nil || resp.Pin.Selector != `[data-testid="save-billing"]` {
		t.Fatalf("pin: %+v", resp.Pin)
	}
	if _, err := os.Stat(filepath.Join(dir, "latest.json")); err != nil {
		t.Fatal(err)
	}
	got, err := c.Call("latest", nil, time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if got.Pin.Name != "Save changes" {
		t.Fatalf("latest name %q", got.Pin.Name)
	}
}

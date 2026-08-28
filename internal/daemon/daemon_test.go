package daemon

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/iammayron/peek/internal/paths"
	"github.com/iammayron/peek/internal/payload"
	"github.com/iammayron/peek/internal/rpc"
)

func TestPinLatestRoundTrip(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PEEK_HOME", dir)
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

func TestPickingSessionIsolation(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PEEK_HOME", dir)
	if err := paths.EnsureHome(); err != nil {
		t.Fatal(err)
	}
	d := New()
	pin := func(sel string) {
		t.Helper()
		raw, _ := json.Marshal(map[string]any{
			"selector": sel,
			"tag":      "div",
			"url":      "https://example.com",
		})
		if _, err := d.savePin(rpc.PinParams{Payload: raw}); err != nil {
			t.Fatal(err)
		}
	}
	got := func(resp *rpc.Response) []string {
		t.Helper()
		out := make([]string, 0, len(resp.Pins))
		for _, p := range resp.Pins {
			out = append(out, p.Selector)
		}
		return out
	}

	pin("a")
	pin("b")
	d.beginPicking()
	pin("c")
	resp := d.doneRequest(&rpc.Request{ID: "1"})
	if sels := got(resp); len(sels) != 1 || sels[0] != "c" {
		t.Fatalf("new pick after abandoned pins: %v", sels)
	}

	d.beginPicking()
	pin("d")
	resp = d.doneRequest(&rpc.Request{ID: "2"})
	if sels := got(resp); len(sels) != 1 || sels[0] != "d" {
		t.Fatalf("second Done should not include first session: %v", sels)
	}

	pin("e")
	d.abandonPicking()
	pin("f")
	resp = d.doneRequest(&rpc.Request{ID: "3"})
	if sels := got(resp); len(sels) != 1 || sels[0] != "f" {
		t.Fatalf("Done after cancel should only have the new pin: %v", sels)
	}
}

func TestSessionResponseKeepsLastReady(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PEEK_HOME", dir)
	if err := paths.EnsureHome(); err != nil {
		t.Fatal(err)
	}
	d := New()
	raw, _ := json.Marshal(map[string]any{"selector": "a", "tag": "div"})
	if _, err := d.savePin(rpc.PinParams{Payload: raw}); err != nil {
		t.Fatal(err)
	}
	if resp := d.doneRequest(&rpc.Request{ID: "1"}); !resp.OK {
		t.Fatal(resp.Error)
	}
	d.beginPicking()
	resp := d.sessionResponse("x")
	if !resp.OK || len(resp.Pins) != 1 || resp.Pins[0].Selector != "a" {
		t.Fatalf("MCP should still see last Done after re-arm, got %+v", resp)
	}
}

func TestPruneHistoryByAgeAndCount(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PEEK_HOME", dir)
	if err := paths.EnsureHome(); err != nil {
		t.Fatal(err)
	}
	write := func(id string, mod time.Time) {
		t.Helper()
		jp := filepath.Join(paths.HistoryDir(), id+".json")
		pp := filepath.Join(paths.HistoryDir(), id+".png")
		if err := os.WriteFile(jp, []byte(`{"id":"`+id+`"}`), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(pp, []byte("x"), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(jp, mod, mod); err != nil {
			t.Fatal(err)
		}
		if err := os.Chtimes(pp, mod, mod); err != nil {
			t.Fatal(err)
		}
	}
	write("old", time.Now().Add(-8*24*time.Hour))
	for i := 0; i < 12; i++ {
		write("n"+string(rune('a'+i)), time.Now())
	}
	pruneHistory()
	entries, err := os.ReadDir(paths.HistoryDir())
	if err != nil {
		t.Fatal(err)
	}
	var jsons int
	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".json" {
			continue
		}
		jsons++
		if e.Name() == "old.json" {
			t.Fatal("pin older than 7 days should be gone")
		}
	}
	if jsons != historyKeep {
		t.Fatalf("keep %d newest, got %d", historyKeep, jsons)
	}
}

func TestExpireStaleSession(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PEEK_HOME", dir)
	if err := paths.EnsureHome(); err != nil {
		t.Fatal(err)
	}
	d := New()
	old := time.Now().UTC().Add(-8 * 24 * time.Hour)
	d.session.Ready = true
	d.session.ReadyAt = &old
	d.session.Pins = []payload.Pin{{ID: "stale", Selector: "a", TS: old}}
	d.lastReady = cloneSession(d.session)
	d.latest = &payload.Pin{ID: "stale", TS: old}
	if err := os.WriteFile(paths.LatestJSON(), []byte(`{}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.LatestPNG(), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	d.expireStale()
	if len(d.session.Pins) != 0 {
		t.Fatalf("stale session still has pins: %+v", d.session.Pins)
	}
	if d.latest != nil {
		t.Fatal("stale latest should be cleared")
	}
	if _, err := os.Stat(paths.LatestPNG()); !os.IsNotExist(err) {
		t.Fatal("stale latest.png should be removed")
	}
}

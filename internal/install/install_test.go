package install

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	peek "github.com/iammayron/peek"
)

func TestAppendPromptHookRepointsMovedBinary(t *testing.T) {
	hooks := map[string]any{
		"UserPromptSubmit": []any{
			map[string]any{"matcher": "", "hooks": []any{
				map[string]any{"type": "command", "command": "afplay beep.mp3"},
			}},
			map[string]any{"matcher": "", "hooks": []any{
				map[string]any{"type": "command", "command": "/old/path/bin/peek hook-prompt"},
			}},
		},
	}
	if !appendPromptHook(hooks, "/new/path/bin/peek hook-prompt") {
		t.Fatal("stale hook path should be rewritten")
	}
	entries := hooks["UserPromptSubmit"].([]any)
	if len(entries) != 2 {
		t.Fatalf("want 2 entries (unrelated hook kept, ours replaced), got %d", len(entries))
	}
	if appendPromptHook(hooks, "/new/path/bin/peek hook-prompt") {
		t.Fatal("second call should be a no-op")
	}
}

func TestPatchTOMLReplacesStaleBlock(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.toml")
	if err := os.WriteFile(path, []byte("[mcp_servers.peek]\ncommand = \"/old/bin/peek\"\nargs = [\"mcp\"]\n\n[mcp_servers.other]\ncommand = \"x\"\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !patchTOML(path, "/new/bin/peek") {
		t.Fatal("patchTOML failed")
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	s := string(got)
	if strings.Contains(s, "/old/bin/peek") {
		t.Fatalf("stale command still present:\n%s", s)
	}
	if strings.Count(s, "[mcp_servers.peek]") != 1 {
		t.Fatalf("want exactly one peek block:\n%s", s)
	}
	if !strings.Contains(s, "[mcp_servers.other]") {
		t.Fatalf("unrelated server was dropped:\n%s", s)
	}
	if !patchTOML(path, "/new/bin/peek") {
		t.Fatal("second call should still report success")
	}
	again, _ := os.ReadFile(path)
	if string(again) != s {
		t.Fatalf("not idempotent:\n%s\n---\n%s", s, again)
	}
}

func TestPrintInstallHelpTargetsTheStoreUnlessDev(t *testing.T) {
	var buf bytes.Buffer
	PrintInstallHelp(&buf, &Result{Binary: "/opt/homebrew/bin/peek", ExtensionDir: "/tmp/ext"})
	if out := buf.String(); !strings.Contains(out, peek.StoreURL) || strings.Contains(out, "Load unpacked") {
		t.Fatalf("store install should point at the listing, got:\n%s", out)
	}

	buf.Reset()
	PrintInstallHelp(&buf, &Result{Binary: "./bin/peek", ExtensionDir: "/tmp/ext", Dev: true})
	if out := buf.String(); !strings.Contains(out, "/tmp/ext") || strings.Contains(out, peek.StoreURL) {
		t.Fatalf("dev install should point at the unpacked dir, got:\n%s", out)
	}
}

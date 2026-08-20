package install

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

func installHooks(bin string) {
	cmd := bin + " hook-prompt"
	_ = patchJSONHooks(filepath.Join(mustHome(), ".claude", "settings.json"), cmd)
	_ = patchJSONHooks(filepath.Join(mustHome(), ".codex", "hooks.json"), cmd)
}

func patchJSONHooks(path, command string) bool {
	dir := filepath.Dir(path)
	if _, err := os.Stat(dir); err != nil {
		return false
	}
	raw, err := os.ReadFile(path)
	root := map[string]any{}
	if err == nil {
		if json.Unmarshal(raw, &root) != nil {
			return false
		}
	}
	hooks, _ := root["hooks"].(map[string]any)
	if hooks == nil {
		hooks = map[string]any{}
		root["hooks"] = hooks
	}
	if !appendPromptHook(hooks, command) {
		return true
	}
	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return false
	}
	return os.WriteFile(path, append(out, '\n'), 0o644) == nil
}

func appendPromptHook(hooks map[string]any, command string) bool {
	entries, _ := hooks["UserPromptSubmit"].([]any)
	for _, e := range entries {
		b, _ := json.Marshal(e)
		if strings.Contains(string(b), "peek hook-prompt") {
			return false
		}
	}
	entry := map[string]any{
		"matcher": "",
		"hooks": []any{
			map[string]any{"type": "command", "command": command},
		},
	}
	hooks["UserPromptSubmit"] = append(entries, entry)
	return true
}

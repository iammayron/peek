package daemon

import (
	"encoding/json"
	"os"
	"time"

	"github.com/iammayron/peek/internal/paths"
	"github.com/iammayron/peek/internal/payload"
)

const hookMaxAge = 10 * time.Minute

// HookPrompt is a Claude Code / Codex UserPromptSubmit hook.
// If the user just hit Done, it injects the pinned elements into that turn.
func HookPrompt() error {
	enc := json.NewEncoder(os.Stdout)
	sess, err := payload.ReadSession(paths.SessionJSON())
	if err != nil || !sess.FreshReady(hookMaxAge) {
		return enc.Encode(map[string]any{})
	}
	sess.Injected = true
	_ = sess.Write(paths.SessionJSON())
	ctx := payload.SessionMarkdown(sess.Pins)
	return enc.Encode(map[string]any{
		"hookSpecificOutput": map[string]any{
			"hookEventName":     "UserPromptSubmit",
			"additionalContext": ctx,
		},
	})
}

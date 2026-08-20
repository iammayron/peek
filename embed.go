package inspectai

import "embed"

// ExtensionFS is the unpacked Chrome extension shipped inside the binary.
//
//go:embed all:extension
var ExtensionFS embed.FS

// SkillMD is copied into ~/.grok/skills, ~/.claude/skills, and ~/.codex/skills.
//
//go:embed skills/inspectai/SKILL.md
var SkillMD string

const (
	Name        = "inspectai"
	Pretty      = "InspectAI"
	Version     = "0.1.0"
	HostName    = "com.inspectai.host"
	ExtensionID = "pddflklmmojokihfohpdcncbkbfhceak"
)

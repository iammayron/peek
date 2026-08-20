package peek

import "embed"

// ExtensionFS is the unpacked Chrome extension shipped inside the binary.
//
//go:embed all:extension
var ExtensionFS embed.FS

// SkillMD is copied into ~/.grok/skills, ~/.claude/skills, and ~/.codex/skills.
//
//go:embed skills/peek/SKILL.md
var SkillMD string

const (
	Name        = "peek"
	Pretty      = "Peek"
	Version     = "0.2.0"
	HostName    = "com.iammayron.peek.host"
	ExtensionID = "pddflklmmojokihfohpdcncbkbfhceak"
)

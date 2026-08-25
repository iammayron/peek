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
	Name     = "peek"
	Pretty   = "Peek"
	Version  = "0.2.2"
	HostName = "com.iammayron.peek.host"
	// ExtensionID is the unpacked build, pinned by the manifest key.
	ExtensionID = "pddflklmmojokihfohpdcncbkbfhceak"
	// StoreExtensionID is the Chrome Web Store build, which the store ids itself.
	StoreExtensionID = "afalnlminndnlfgnlphbelelpcblcbld"
	// StoreURL is the public listing for the store build.
	StoreURL = "https://chromewebstore.google.com/detail/peek/" + StoreExtensionID
)

// ExtensionIDs are the builds allowed to talk to the daemon.
var ExtensionIDs = []string{ExtensionID, StoreExtensionID}

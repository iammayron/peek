package install

import (
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	inspectai "github.com/iammayron/inspectai"
	"github.com/iammayron/inspectai/internal/daemon"
	"github.com/iammayron/inspectai/internal/paths"
	"github.com/iammayron/inspectai/internal/rpc"
)

type Result struct {
	Binary       string
	ExtensionDir string
	NativeHosts  []string
	Agents       []string
	Launchd      string
	Notes        []string
}

func Install(dev bool) (*Result, error) {
	if err := paths.EnsureHome(); err != nil {
		return nil, err
	}
	exe, err := os.Executable()
	if err != nil {
		return nil, err
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		exe, _ = os.Executable()
	}

	res := &Result{}
	bin, err := installBinary(exe, dev)
	if err != nil {
		return nil, err
	}
	res.Binary = bin

	extDir, err := installExtension(dev)
	if err != nil {
		return nil, err
	}
	res.ExtensionDir = extDir

	hosts, notes := installNativeHosts(bin)
	res.NativeHosts = hosts
	res.Notes = append(res.Notes, notes...)

	if path := installLaunchAgent(bin); path != "" {
		res.Launchd = path
	}

	if err := daemon.EnsureRunning(); err != nil {
		res.Notes = append(res.Notes, "daemon: "+err.Error())
	}

	res.Agents = installAgents(bin)
	installSkills()
	installHooks(bin)
	return res, nil
}

func installBinary(exe string, dev bool) (string, error) {
	if dev {
		return exe, nil
	}
	destDir, err := binDir()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return "", err
	}
	dest := filepath.Join(destDir, "inspectai")
	if sameFile(exe, dest) {
		return dest, nil
	}
	src, err := os.Open(exe)
	if err != nil {
		return "", err
	}
	defer src.Close()
	tmp := dest + ".tmp"
	dst, err := os.OpenFile(tmp, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		return "", err
	}
	dst.Close()
	if err := os.Rename(tmp, dest); err != nil {
		return "", err
	}
	return dest, nil
}

func binDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	if runtime.GOOS == "darwin" {
		if st, err := os.Stat("/opt/homebrew/bin"); err == nil && st.IsDir() && writable("/opt/homebrew/bin") {
			return "/opt/homebrew/bin", nil
		}
		if st, err := os.Stat("/usr/local/bin"); err == nil && st.IsDir() && writable("/usr/local/bin") {
			return "/usr/local/bin", nil
		}
	}
	return filepath.Join(home, ".local", "bin"), nil
}

func writable(dir string) bool {
	f, err := os.CreateTemp(dir, ".inspectai-write-*")
	if err != nil {
		return false
	}
	name := f.Name()
	f.Close()
	_ = os.Remove(name)
	return true
}

func sameFile(a, b string) bool {
	ai, err1 := os.Stat(a)
	bi, err2 := os.Stat(b)
	if err1 != nil || err2 != nil {
		return false
	}
	return os.SameFile(ai, bi)
}

func installExtension(dev bool) (string, error) {
	dest := paths.ExtensionDir()
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return "", err
	}
	if err := fs.WalkDir(inspectai.ExtensionFS, "extension", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel("extension", path)
		if rel == "." {
			return nil
		}
		target := filepath.Join(dest, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		data, err := inspectai.ExtensionFS.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, 0o644)
	}); err != nil {
		return "", err
	}
	if dev {
		if cwd, err := os.Getwd(); err == nil {
			live := filepath.Join(cwd, "extension")
			if st, err := os.Stat(live); err == nil && st.IsDir() {
				return live, nil
			}
		}
	}
	return dest, nil
}

type nativeHostManifest struct {
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	Path           string   `json:"path"`
	Type           string   `json:"type"`
	AllowedOrigins []string `json:"allowed_origins"`
}

func installNativeHosts(bin string) (written []string, notes []string) {
	manifest := nativeHostManifest{
		Name:        inspectai.HostName,
		Description: "InspectAI native messaging host",
		Path:        bin,
		Type:        "stdio",
		AllowedOrigins: []string{
			"chrome-extension://" + inspectai.ExtensionID + "/",
		},
	}
	// Chrome launches this path with no extra args and piped stdio.
	// inspectai with no args + non-TTY stdin enters native-host mode.
	shim := filepath.Join(paths.Home(), "native-host.sh")
	script := "#!/bin/sh\nexec \"" + bin + "\" native-host\n"
	_ = os.WriteFile(shim, []byte(script), 0o755)
	body, _ := json.MarshalIndent(manifest, "", "  ")
	for _, dir := range nativeHostDirs() {
		parent := filepath.Dir(dir)
		if _, err := os.Stat(parent); err != nil {
			continue
		}
		if err := os.MkdirAll(dir, 0o755); err != nil {
			notes = append(notes, dir+": "+err.Error())
			continue
		}
		path := filepath.Join(dir, inspectai.HostName+".json")
		if err := os.WriteFile(path, body, 0o644); err != nil {
			notes = append(notes, path+": "+err.Error())
			continue
		}
		written = append(written, path)
	}
	if len(written) == 0 {
		notes = append(notes, "no Chromium browsers found to register a native host")
	}
	return written, notes
}

func nativeHostDirs() []string {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil
	}
	var rels []string
	if runtime.GOOS == "darwin" {
		base := filepath.Join(home, "Library", "Application Support")
		rels = []string{
			filepath.Join(base, "Google/Chrome/NativeMessagingHosts"),
			filepath.Join(base, "Google/Chrome Canary/NativeMessagingHosts"),
			filepath.Join(base, "Google/Chrome Beta/NativeMessagingHosts"),
			filepath.Join(base, "BraveSoftware/Brave-Browser/NativeMessagingHosts"),
			filepath.Join(base, "Microsoft Edge/NativeMessagingHosts"),
			filepath.Join(base, "Chromium/NativeMessagingHosts"),
			filepath.Join(base, "Arc/User Data/NativeMessagingHosts"),
			filepath.Join(base, "Vivaldi/NativeMessagingHosts"),
			filepath.Join(base, "Citro Labs/ego lite/NativeMessagingHosts"),
			filepath.Join(base, "Citro Labs/NativeMessagingHosts"),
			filepath.Join(base, "ego lite/NativeMessagingHosts"),
			filepath.Join(base, "BrowserOS/NativeMessagingHosts"),
		}
	} else {
		cfg := filepath.Join(home, ".config")
		rels = []string{
			filepath.Join(cfg, "google-chrome/NativeMessagingHosts"),
			filepath.Join(cfg, "google-chrome-unstable/NativeMessagingHosts"),
			filepath.Join(cfg, "chromium/NativeMessagingHosts"),
			filepath.Join(cfg, "BraveSoftware/Brave-Browser/NativeMessagingHosts"),
			filepath.Join(cfg, "microsoft-edge/NativeMessagingHosts"),
			filepath.Join(cfg, "vivaldi/NativeMessagingHosts"),
		}
	}
	return rels
}

func installLaunchAgent(bin string) string {
	if runtime.GOOS != "darwin" {
		return installSystemd(bin)
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	dir := filepath.Join(home, "Library", "LaunchAgents")
	_ = os.MkdirAll(dir, 0o755)
	plistPath := filepath.Join(dir, "com.inspectai.daemon.plist")
	plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.inspectai.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>%s</string>
    <string>daemon</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>%s</string>
  <key>StandardErrorPath</key><string>%s</string>
</dict>
</plist>
`, bin, paths.LogFile(), paths.LogFile())
	if err := os.WriteFile(plistPath, []byte(plist), 0o644); err != nil {
		return ""
	}
	_ = exec.Command("launchctl", "unload", plistPath).Run()
	_ = exec.Command("launchctl", "load", plistPath).Run()
	return plistPath
}

func installSystemd(bin string) string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	dir := filepath.Join(home, ".config", "systemd", "user")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return ""
	}
	path := filepath.Join(dir, "inspectai.service")
	unit := fmt.Sprintf(`[Unit]
Description=InspectAI daemon
[Service]
ExecStart=%s daemon
Restart=on-failure
[Install]
WantedBy=default.target
`, bin)
	if err := os.WriteFile(path, []byte(unit), 0o644); err != nil {
		return ""
	}
	_ = exec.Command("systemctl", "--user", "daemon-reload").Run()
	_ = exec.Command("systemctl", "--user", "enable", "--now", "inspectai.service").Run()
	return path
}

func installSkills() {
	home, _ := os.UserHomeDir()
	targets := []struct{ root, dest string }{
		{filepath.Join(home, ".grok"), filepath.Join(home, ".grok", "skills", "inspectai", "SKILL.md")},
		{filepath.Join(home, ".claude"), filepath.Join(home, ".claude", "skills", "inspectai", "SKILL.md")},
		{filepath.Join(home, ".codex"), filepath.Join(home, ".codex", "skills", "inspectai", "SKILL.md")},
	}
	for _, t := range targets {
		if _, err := os.Stat(t.root); err != nil {
			continue
		}
		_ = os.MkdirAll(filepath.Dir(t.dest), 0o755)
		_ = os.WriteFile(t.dest, []byte(inspectai.SkillMD), 0o644)
	}
}

func installAgents(bin string) []string {
	var ok []string
	if _, err := exec.LookPath("grok"); err == nil {
		cmd := exec.Command("grok", "mcp", "add", "inspectai", "--", bin, "mcp")
		if err := cmd.Run(); err == nil {
			ok = append(ok, "grok")
		} else {
			if patchTOML(filepath.Join(mustHome(), ".grok", "config.toml"), bin) {
				ok = append(ok, "grok (config.toml)")
			}
		}
	} else if patchTOML(filepath.Join(mustHome(), ".grok", "config.toml"), bin) {
		ok = append(ok, "grok (config.toml)")
	}
	if _, err := exec.LookPath("claude"); err == nil {
		cmd := exec.Command("claude", "mcp", "add", "--scope", "user", "inspectai", "--", bin, "mcp")
		if err := cmd.Run(); err == nil {
			ok = append(ok, "claude")
		} else if patchClaudeJSON(bin) {
			ok = append(ok, "claude (json)")
		}
	} else if patchClaudeJSON(bin) {
		ok = append(ok, "claude (json)")
	}
	if _, err := exec.LookPath("codex"); err == nil {
		cmd := exec.Command("codex", "mcp", "add", "inspectai", "--", bin, "mcp")
		if err := cmd.Run(); err == nil {
			ok = append(ok, "codex")
		} else if patchTOML(filepath.Join(mustHome(), ".codex", "config.toml"), bin) {
			ok = append(ok, "codex (config.toml)")
		}
	} else if patchTOML(filepath.Join(mustHome(), ".codex", "config.toml"), bin) {
		ok = append(ok, "codex (config.toml)")
	}
	if patchCursor(bin) {
		ok = append(ok, "cursor")
	}
	return ok
}

func mustHome() string {
	h, _ := os.UserHomeDir()
	return h
}

func mcpBlock(bin string) string {
	return fmt.Sprintf("\n[mcp_servers.inspectai]\ncommand = %q\nargs = [\"mcp\"]\n", bin)
}

func patchTOML(path, bin string) bool {
	if _, err := os.Stat(filepath.Dir(path)); err != nil {
		return false
	}
	data, _ := os.ReadFile(path)
	s := string(data)
	if strings.Contains(s, "[mcp_servers.inspectai]") {
		return true
	}
	_ = os.MkdirAll(filepath.Dir(path), 0o755)
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return false
	}
	defer f.Close()
	_, err = f.WriteString(mcpBlock(bin))
	return err == nil
}

func patchClaudeJSON(bin string) bool {
	path := filepath.Join(mustHome(), ".claude.json")
	raw, err := os.ReadFile(path)
	var root map[string]any
	if err != nil {
		if os.IsNotExist(err) {
			root = map[string]any{}
		} else {
			return false
		}
	} else if json.Unmarshal(raw, &root) != nil {
		return false
	}
	servers, _ := root["mcpServers"].(map[string]any)
	if servers == nil {
		servers = map[string]any{}
		root["mcpServers"] = servers
	}
	servers["inspectai"] = map[string]any{"command": bin, "args": []string{"mcp"}}
	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return false
	}
	return os.WriteFile(path, append(out, '\n'), 0o644) == nil
}

func patchCursor(bin string) bool {
	path := filepath.Join(mustHome(), ".cursor", "mcp.json")
	if _, err := os.Stat(filepath.Dir(path)); err != nil {
		return false
	}
	raw, err := os.ReadFile(path)
	var root map[string]any
	if err != nil {
		root = map[string]any{}
	} else if json.Unmarshal(raw, &root) != nil {
		root = map[string]any{}
	}
	servers, _ := root["mcpServers"].(map[string]any)
	if servers == nil {
		servers = map[string]any{}
		root["mcpServers"] = servers
	}
	servers["inspectai"] = map[string]any{"command": bin, "args": []string{"mcp"}}
	out, err := json.MarshalIndent(root, "", "  ")
	if err != nil {
		return false
	}
	return os.WriteFile(path, append(out, '\n'), 0o644) == nil
}

func Doctor() {
	fmt.Printf("InspectAI %s\n", inspectai.Version)
	exe, _ := os.Executable()
	fmt.Printf("  binary          %s\n", exe)
	fmt.Printf("  home            %s\n", paths.Home())
	fmt.Printf("  extension id    %s\n", inspectai.ExtensionID)
	fmt.Printf("  extension dir   %s\n", existLabel(paths.ExtensionDir()))
	fmt.Printf("  native shim     %s\n", existLabel(filepath.Join(paths.Home(), "native-host.sh")))

	status := "not running"
	if c, err := rpc.Dial(400 * time.Millisecond); err == nil {
		if resp, err := c.Call("status", nil, 0); err == nil && resp.Status != nil {
			st := resp.Status
			status = "running"
			if st.ExtensionConnected {
				status += ", extension connected"
			} else {
				status += ", extension not connected"
			}
			if st.LastSelector != "" {
				status += fmt.Sprintf("\n  last pin        %s  (%ds ago)\n                  %s", st.LastSelector, st.LastPinAgeSec, st.LastURL)
			}
		}
		_ = c.Close()
	}
	fmt.Printf("  daemon          %s\n", status)

	n := 0
	for _, dir := range nativeHostDirs() {
		p := filepath.Join(dir, inspectai.HostName+".json")
		if _, err := os.Stat(p); err == nil {
			fmt.Printf("  native host     %s\n", p)
			n++
		}
	}
	if n == 0 {
		fmt.Printf("  native host     missing (run inspectai install)\n")
	}
	for _, pair := range [][2]string{
		{"grok skill", filepath.Join(mustHome(), ".grok", "skills", "inspectai", "SKILL.md")},
		{"claude skill", filepath.Join(mustHome(), ".claude", "skills", "inspectai", "SKILL.md")},
		{"codex skill", filepath.Join(mustHome(), ".codex", "skills", "inspectai", "SKILL.md")},
	} {
		fmt.Printf("  %-16s %s\n", pair[0], existLabel(pair[1]))
	}
}

func existLabel(path string) string {
	if _, err := os.Stat(path); err != nil {
		return path + "  (missing)"
	}
	return path
}

func PrintInstallHelp(res *Result) {
	fmt.Println("InspectAI installed.")
	fmt.Println()
	fmt.Println("  1. Open chrome://extensions")
	fmt.Println("  2. Enable Developer mode")
	fmt.Println("  3. Load unpacked →")
	fmt.Printf("     %s\n", res.ExtensionDir)
	fmt.Println()
	fmt.Println("Shortcut: Alt+Shift+I  (or click the toolbar icon)")
	fmt.Println("Then in Grok / Claude / Codex: “look at this”.")
	fmt.Println()
	fmt.Printf("binary:    %s\n", res.Binary)
	if res.Launchd != "" {
		fmt.Printf("service:   %s\n", res.Launchd)
	}
	if len(res.Agents) > 0 {
		fmt.Printf("agents:    %s\n", strings.Join(res.Agents, ", "))
	}
	for _, n := range res.Notes {
		fmt.Printf("note:      %s\n", n)
	}
}

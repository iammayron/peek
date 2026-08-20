package paths

import (
	"os"
	"path/filepath"
	"runtime"
)

func Home() string {
	if h := os.Getenv("PEEK_HOME"); h != "" {
		return h
	}
	dir, err := os.UserHomeDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, ".peek")
}

func Socket() string      { return filepath.Join(Home(), "rpc.sock") }
func PIDFile() string     { return filepath.Join(Home(), "daemon.pid") }
func LogFile() string     { return filepath.Join(Home(), "daemon.log") }
func LatestJSON() string  { return filepath.Join(Home(), "latest.json") }
func LatestPNG() string   { return filepath.Join(Home(), "latest.png") }
func SessionJSON() string { return filepath.Join(Home(), "session.json") }
func HistoryDir() string  { return filepath.Join(Home(), "history") }
func DataDir() string     { return appData() }

func ExtensionDir() string {
	return filepath.Join(DataDir(), "extension")
}

func EnsureHome() error {
	if err := os.MkdirAll(Home(), 0o700); err != nil {
		return err
	}
	return os.MkdirAll(HistoryDir(), 0o700)
}

func appData() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = os.TempDir()
	}
	switch runtime.GOOS {
	case "darwin":
		return filepath.Join(home, "Library", "Application Support", "peek")
	case "windows":
		if base := os.Getenv("APPDATA"); base != "" {
			return filepath.Join(base, "peek")
		}
		return filepath.Join(home, "AppData", "Roaming", "peek")
	default:
		if base := os.Getenv("XDG_DATA_HOME"); base != "" {
			return filepath.Join(base, "peek")
		}
		return filepath.Join(home, ".local", "share", "peek")
	}
}

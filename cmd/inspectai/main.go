package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	inspectai "github.com/iammayron/inspectai"
	"github.com/iammayron/inspectai/internal/daemon"
	"github.com/iammayron/inspectai/internal/install"
	mcpserver "github.com/iammayron/inspectai/internal/mcp"
	"github.com/iammayron/inspectai/internal/payload"
)

func main() {
	if len(os.Args) < 2 {
		// Chrome native messaging launches the host with no args and piped stdio.
		if !isTTY(os.Stdin) {
			logNativeStart("no-args stdin-pipe")
			if err := daemon.RunNativeHost(); err != nil {
				logNativeStart("exit: " + err.Error())
				fmt.Fprintln(os.Stderr, err)
				os.Exit(1)
			}
			return
		}
		usage()
		os.Exit(2)
	}
	var err error
	switch os.Args[1] {
	case "daemon":
		err = daemon.Run()
	case "native-host":
		logNativeStart("argv native-host")
		err = daemon.RunNativeHost()
	case "mcp":
		err = mcpserver.Run()
	case "latest":
		err = cmdLatest(os.Args[2:])
	case "wait":
		err = cmdWait(os.Args[2:])
	case "install":
		err = cmdInstall(os.Args[2:])
	case "doctor":
		install.Doctor()
	case "version", "-v", "--version":
		fmt.Printf("%s %s\n", inspectai.Name, inspectai.Version)
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", os.Args[1])
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func logNativeStart(why string) {
	_ = os.MkdirAll(os.Getenv("HOME")+"/.inspectai", 0o700)
	f, err := os.OpenFile(os.Getenv("HOME")+"/.inspectai/native-host.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s pid=%d %s\n", time.Now().Format(time.RFC3339), os.Getpid(), why)
}

func isTTY(f *os.File) bool {
	st, err := f.Stat()
	if err != nil {
		return false
	}
	return st.Mode()&os.ModeCharDevice != 0
}

func usage() {
	fmt.Fprintf(os.Stderr, `InspectAI %s — pin a DOM element for your coding agent.

Commands:
  install [--dev]   Register native host, daemon, MCP, and skills
  doctor            Check the bridge, extension, and last pin
  latest [--md]     Print the current pin as JSON (or markdown)
  wait [--timeout]  Block until the next pin (seconds, default 60)
  mcp               stdio MCP server for Grok / Claude / Codex
  daemon            Long-running host (launchd / systemd)
  native-host       Chrome native messaging (called by the browser)
  version

Install:
  curl -fsSL https://raw.githubusercontent.com/iammayron/inspectai/main/install.sh | sh

Then load the unpacked extension printed by install, press Alt+Shift+I, click.
`, inspectai.Version)
}

func cmdLatest(args []string) error {
	fs := flag.NewFlagSet("latest", flag.ExitOnError)
	md := fs.Bool("md", false, "markdown instead of JSON")
	_ = fs.Parse(args)
	c, err := daemon.DialClient()
	if err != nil {
		return err
	}
	defer c.Close()
	resp, err := c.Call("latest", nil, 5*time.Second)
	if err != nil {
		return err
	}
	return printPin(resp.Pin, *md)
}

func cmdWait(args []string) error {
	fs := flag.NewFlagSet("wait", flag.ExitOnError)
	timeout := fs.Int("timeout", 60, "seconds to wait")
	md := fs.Bool("md", false, "markdown instead of JSON")
	_ = fs.Parse(args)
	c, err := daemon.DialClient()
	if err != nil {
		return err
	}
	defer c.Close()
	resp, err := c.Call("wait", map[string]any{"timeoutSec": *timeout}, time.Duration(*timeout+5)*time.Second)
	if err != nil {
		return err
	}
	return printPin(resp.Pin, *md)
}

func cmdInstall(args []string) error {
	fs := flag.NewFlagSet("install", flag.ExitOnError)
	dev := fs.Bool("dev", false, "use this binary and the repo extension dir")
	_ = fs.Parse(args)
	res, err := install.Install(*dev)
	if err != nil {
		return err
	}
	install.PrintInstallHelp(res)
	fmt.Println()
	install.Doctor()
	return nil
}

func printPin(pin *payload.Pin, md bool) error {
	if pin == nil {
		return fmt.Errorf("no pin")
	}
	if md {
		fmt.Print(pin.Markdown())
		return nil
	}
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(pin)
}

package mcp

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"time"

	"github.com/iammayron/peek"
	"github.com/iammayron/peek/internal/daemon"
	"github.com/iammayron/peek/internal/payload"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func Run() error {
	s := server.NewMCPServer(peek.Pretty, peek.Version)

	s.AddTool(mcp.NewTool("get_picked_element",
		mcp.WithDescription("Return the DOM element(s) the user pinned in their browser with Peek (current session), including cropped screenshots, unique selectors, XPath, role/name, box, computed styles, and truncated HTML. Use when the user says 'this', 'these', 'the selected/inspected/pinned element', 'take a peek', or 'look at this'."),
	), getPicked)

	s.AddTool(mcp.NewTool("wait_for_pick",
		mcp.WithDescription("Open the Peek panel in the user's browser and block until they hit Done. Use when nothing is pinned yet and they are about to pick in the UI."),
		mcp.WithNumber("timeout_sec",
			mcp.Description("Seconds to wait for Done. Default 120, max 300."),
			mcp.DefaultNumber(120),
		),
	), waitForPick)

	s.AddTool(mcp.NewTool("list_picks",
		mcp.WithDescription("List the current Peek session pins (metadata only, no screenshots)."),
	), listPicks)

	return server.ServeStdio(s)
}

func getPicked(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	c, err := daemon.DialClient()
	if err != nil {
		return mcp.NewToolResultError("Peek daemon is not running: " + err.Error()), nil
	}
	defer c.Close()
	resp, err := c.Call("session", nil, 5*time.Second)
	if err != nil {
		return mcp.NewToolResultError("No element pinned yet. Ask them to use the Peek toolbar icon, pin in the page, hit Done, then paste. (" + err.Error() + ")"), nil
	}
	if len(resp.Pins) > 0 {
		return pinsResult(resp.Pins)
	}
	return pinResult(resp.Pin)
}

func waitForPick(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	timeout := 120.0
	if v, err := req.RequireFloat("timeout_sec"); err == nil && v > 0 {
		timeout = v
	} else if args := req.GetArguments(); args != nil {
		if n, ok := args["timeout_sec"].(float64); ok && n > 0 {
			timeout = n
		}
	}
	c, err := daemon.DialClient()
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	defer c.Close()
	wait := time.Duration(timeout+5) * time.Second
	resp, err := c.Call("wait", map[string]any{"timeoutSec": int(timeout)}, wait)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	if len(resp.Pins) > 0 {
		return pinsResult(resp.Pins)
	}
	return pinResult(resp.Pin)
}

func listPicks(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	c, err := daemon.DialClient()
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	defer c.Close()
	resp, err := c.Call("list", nil, 5*time.Second)
	if err != nil {
		return mcp.NewToolResultError(err.Error()), nil
	}
	b, _ := json.MarshalIndent(resp.Pins, "", "  ")
	return mcp.NewToolResultText(string(b)), nil
}

func pinsResult(pins []payload.Pin) (*mcp.CallToolResult, error) {
	if len(pins) == 0 {
		return mcp.NewToolResultError("no pin"), nil
	}
	if len(pins) == 1 {
		return pinResult(&pins[0])
	}
	contents := []mcp.Content{mcp.NewTextContent(payload.SessionMarkdown(pins))}
	for i := range pins {
		p := pins[i]
		if p.ScreenshotPath == "" {
			continue
		}
		raw, err := os.ReadFile(p.ScreenshotPath)
		if err != nil {
			continue
		}
		mime := p.ScreenshotMIME
		if mime == "" {
			mime = "image/png"
		}
		contents = append(contents, mcp.NewImageContent(base64.StdEncoding.EncodeToString(raw), mime))
	}
	return &mcp.CallToolResult{Content: contents}, nil
}

func pinResult(pin *payload.Pin) (*mcp.CallToolResult, error) {
	if pin == nil {
		return mcp.NewToolResultError("no pin"), nil
	}
	text := pin.Markdown()
	if pin.ScreenshotPath == "" {
		return mcp.NewToolResultText(text), nil
	}
	raw, err := os.ReadFile(pin.ScreenshotPath)
	if err != nil {
		return mcp.NewToolResultText(text + "\n\n(screenshot missing: " + err.Error() + ")"), nil
	}
	mime := pin.ScreenshotMIME
	if mime == "" {
		mime = "image/png"
	}
	return mcp.NewToolResultImage(text, base64.StdEncoding.EncodeToString(raw), mime), nil
}

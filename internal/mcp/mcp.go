package mcp

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"os"
	"time"

	inspectai "github.com/iammayron/inspectai"
	"github.com/iammayron/inspectai/internal/daemon"
	"github.com/iammayron/inspectai/internal/payload"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"
)

func Run() error {
	s := server.NewMCPServer(inspectai.Pretty, inspectai.Version)

	s.AddTool(mcp.NewTool("get_picked_element",
		mcp.WithDescription("Return the DOM element the user last pinned in their browser with InspectAI, including a cropped screenshot, unique selector, XPath, role/name, box, computed styles, and truncated HTML. Use when the user says 'this', 'this element', 'the selected/inspected/pinned element', or 'look at this'."),
	), getPicked)

	s.AddTool(mcp.NewTool("wait_for_pick",
		mcp.WithDescription("Arm the InspectAI overlay in the user's browser and block until they click an element. Use when nothing is pinned yet, or when the user offers to show you the element."),
		mcp.WithNumber("timeout_sec",
			mcp.Description("Seconds to wait for a click. Default 60, max 300."),
			mcp.DefaultNumber(60),
		),
	), waitForPick)

	s.AddTool(mcp.NewTool("list_picks",
		mcp.WithDescription("List recent InspectAI pins (metadata only, no screenshots)."),
	), listPicks)

	return server.ServeStdio(s)
}

func getPicked(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	c, err := daemon.DialClient()
	if err != nil {
		return mcp.NewToolResultError("InspectAI daemon is not running: " + err.Error()), nil
	}
	defer c.Close()
	resp, err := c.Call("latest", nil, 5*time.Second)
	if err != nil {
		return mcp.NewToolResultError("No element pinned yet. Ask the user to click one, or call wait_for_pick. (" + err.Error() + ")"), nil
	}
	return pinResult(resp.Pin)
}

func waitForPick(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
	timeout := 60.0
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

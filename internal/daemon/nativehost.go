package daemon

import (
	"encoding/json"
	"io"
	"os"
	"sync"
	"time"

	"github.com/iammayron/peek"
	"github.com/iammayron/peek/internal/nativemsg"
	"github.com/iammayron/peek/internal/rpc"
)

func RunNativeHost() error {
	if err := EnsureRunning(); err != nil {
		return err
	}

	calls, err := rpc.Dial(2 * time.Second)
	if err != nil {
		return err
	}
	defer calls.Close()

	events, err := rpc.Dial(2 * time.Second)
	if err != nil {
		return err
	}
	defer events.Close()

	hello := rpc.HelloParams{Role: "bridge", ExtensionID: peek.ExtensionID}
	if _, err := events.Call("hello", hello, 2*time.Second); err != nil {
		return err
	}

	var outMu sync.Mutex
	go func() {
		for {
			raw, err := nativemsg.Read(os.Stdin)
			if err != nil {
				os.Exit(0)
			}
			var msg map[string]any
			if err := json.Unmarshal(raw, &msg); err != nil {
				continue
			}
			resp, err := calls.Call("from-extension", msg, 15*time.Second)
			ack := map[string]any{"type": "ok"}
			if err != nil {
				ack = map[string]any{"type": "error", "error": err.Error()}
			} else if resp != nil && resp.Pin != nil {
				ack["id"] = resp.Pin.ID
			}
			body, _ := json.Marshal(ack)
			outMu.Lock()
			_ = nativemsg.Write(os.Stdout, body)
			outMu.Unlock()
		}
	}()

	for {
		ev, err := events.Recv()
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return nil
		}
		if ev.Type == "arm" {
			body, _ := json.Marshal(map[string]any{"type": "arm"})
			outMu.Lock()
			_ = nativemsg.Write(os.Stdout, body)
			outMu.Unlock()
		}
	}
}

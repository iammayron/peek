package daemon

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"time"

	"github.com/iammayron/peek"
	"github.com/iammayron/peek/internal/rpc"
)

const HTTPPort = 17321

func (d *Daemon) startHTTP(ctx context.Context) {
	mux := http.NewServeMux()
	mux.HandleFunc("/status", d.handleHTTPStatus)
	mux.HandleFunc("/hello", d.handleHTTPHello)
	mux.HandleFunc("/pin", d.handleHTTPPin)
	mux.HandleFunc("/session", d.handleHTTPSession)
	mux.HandleFunc("/done", d.handleHTTPDone)
	mux.HandleFunc("/arm", d.handleHTTPArm)

	srv := &http.Server{
		Handler:           withCORS(mux),
		ReadHeaderTimeout: 5 * time.Second,
	}
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", HTTPPort))
	if err != nil {
		fmt.Printf("peek http: %v\n", err)
		return
	}
	go func() {
		<-ctx.Done()
		_ = srv.Close()
	}()
	_ = srv.Serve(ln)
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if !allowedOrigin(origin) && origin != "" {
			http.Error(w, "forbidden origin", http.StatusForbidden)
			return
		}
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			w.Header().Set("Access-Control-Allow-Origin", "chrome-extension://"+peek.ExtensionID)
		}
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Peek")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func allowedOrigin(origin string) bool {
	if origin == "" {
		return true
	}
	want := "chrome-extension://" + peek.ExtensionID
	return origin == want
}

func (d *Daemon) handleHTTPStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, d.status())
}

func (d *Daemon) handleHTTPHello(w http.ResponseWriter, r *http.Request) {
	d.mu.Lock()
	d.extHello = time.Now()
	d.mu.Unlock()
	writeJSON(w, map[string]any{"ok": true, "type": "hello"})
}

func (d *Daemon) handleHTTPSession(w http.ResponseWriter, r *http.Request) {
	resp := d.sessionResponse("")
	if !resp.OK {
		http.Error(w, resp.Error, http.StatusNotFound)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "pins": resp.Pins})
}

func (d *Daemon) handleHTTPDone(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	resp := d.doneRequest(&rpc.Request{ID: "http"})
	if !resp.OK {
		http.Error(w, resp.Error, http.StatusBadRequest)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "text": resp.Text, "count": len(resp.Pins)})
}

func (d *Daemon) handleHTTPPin(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodDelete {
		id := r.URL.Query().Get("id")
		resp := d.unpinRequest(&rpc.Request{ID: "http", Params: jsonRawID(id)})
		if !resp.OK {
			http.Error(w, resp.Error, http.StatusBadRequest)
			return
		}
		writeJSON(w, map[string]any{"ok": true, "pins": resp.Pins})
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "POST only", http.StatusMethodNotAllowed)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 8<<20))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var msg map[string]any
	if err := json.Unmarshal(body, &msg); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	var p rpc.PinParams
	_ = json.Unmarshal(body, &p)
	if p.Payload == nil {
		if inner, ok := msg["payload"]; ok {
			p.Payload, _ = json.Marshal(inner)
		}
		if s, ok := msg["pngBase64"].(string); ok {
			p.PngBase64 = s
		}
	}
	pin, err := d.savePin(p)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"ok": true, "type": "ok", "id": pin.ID})
}

func (d *Daemon) handleHTTPArm(w http.ResponseWriter, r *http.Request) {
	timeout := 20 * time.Second
	if s := r.URL.Query().Get("timeout"); s != "" {
		if n, err := strconv.Atoi(s); err == nil && n > 0 {
			timeout = time.Duration(n) * time.Second
		}
	}
	d.mu.Lock()
	d.extHello = time.Now()
	ch := make(chan struct{}, 1)
	d.httpArm = append(d.httpArm, ch)
	d.mu.Unlock()
	defer d.dropHTTPArm(ch)

	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-ch:
		writeJSON(w, map[string]any{"ok": true, "type": "arm"})
	case <-timer.C:
		writeJSON(w, map[string]any{"ok": true, "type": "idle"})
	case <-r.Context().Done():
		return
	}
}

func (d *Daemon) dropHTTPArm(ch chan struct{}) {
	d.mu.Lock()
	defer d.mu.Unlock()
	out := d.httpArm[:0]
	for _, c := range d.httpArm {
		if c != ch {
			out = append(out, c)
		}
	}
	d.httpArm = out
}

func jsonRawID(id string) json.RawMessage {
	b, _ := json.Marshal(map[string]string{"id": id})
	return b
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}

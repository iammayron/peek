package daemon

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sync"
	"syscall"
	"time"

	"crypto/rand"

	"github.com/iammayron/inspectai/internal/paths"
	"github.com/iammayron/inspectai/internal/payload"
	"github.com/iammayron/inspectai/internal/rpc"
)

const historyKeep = 10

type bridge struct {
	conn net.Conn
	mu   *sync.Mutex
}

type Daemon struct {
	mu          sync.Mutex
	latest      *payload.Pin
	session     payload.Session
	waiters     []chan payload.Pin
	doneWaiters []chan []payload.Pin
	bridges     map[net.Conn]*bridge
	httpArm     []chan struct{}
	extHello    time.Time
}

func New() *Daemon {
	return &Daemon{bridges: map[net.Conn]*bridge{}, session: payload.NewSession()}
}

func Run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	return Serve(ctx)
}

func Serve(ctx context.Context) error {
	if err := paths.EnsureHome(); err != nil {
		return err
	}
	ln, err := listen()
	if err != nil {
		if errors.Is(err, errAlreadyRunning) {
			fmt.Fprintln(os.Stderr, "inspectai daemon already running")
			return nil
		}
		return err
	}
	defer ln.Close()
	_ = os.WriteFile(paths.PIDFile(), []byte(fmt.Sprintf("%d\n", os.Getpid())), 0o600)
	defer os.Remove(paths.PIDFile())
	defer os.Remove(paths.Socket())

	d := New()
	d.loadLatest()
	go d.startHTTP(ctx)

	go func() {
		<-ctx.Done()
		_ = ln.Close()
	}()

	for {
		conn, err := ln.Accept()
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			if errors.Is(err, net.ErrClosed) {
				return nil
			}
			continue
		}
		go d.handle(conn)
	}
}

var errAlreadyRunning = errors.New("already running")

func listen() (net.Listener, error) {
	sock := paths.Socket()
	if c, err := net.DialTimeout("unix", sock, 200*time.Millisecond); err == nil {
		_ = c.Close()
		return nil, errAlreadyRunning
	}
	_ = os.Remove(sock)
	ln, err := net.Listen("unix", sock)
	if err != nil {
		return nil, err
	}
	_ = os.Chmod(sock, 0o600)
	return ln, nil
}

func EnsureRunning() error {
	if err := paths.EnsureHome(); err != nil {
		return err
	}
	if c, err := net.DialTimeout("unix", paths.Socket(), 200*time.Millisecond); err == nil {
		_ = c.Close()
		return nil
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	cmd := exec.Command(exe, "daemon")
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	logf, err := os.OpenFile(paths.LogFile(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o600)
	if err == nil {
		cmd.Stdout = logf
		cmd.Stderr = logf
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if c, err := net.DialTimeout("unix", paths.Socket(), 100*time.Millisecond); err == nil {
			_ = c.Close()
			return nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	return fmt.Errorf("daemon did not start")
}

func DialClient() (*rpc.Client, error) {
	if err := EnsureRunning(); err != nil {
		return nil, err
	}
	return rpc.Dial(2 * time.Second)
}

func (d *Daemon) loadLatest() {
	p, err := payload.ReadFile(paths.LatestJSON())
	if err == nil {
		d.latest = &p
	}
	if s, err := payload.ReadSession(paths.SessionJSON()); err == nil {
		d.session = s
	}
}

func (d *Daemon) handle(conn net.Conn) {
	defer conn.Close()
	sc := bufio.NewScanner(conn)
	sc.Buffer(make([]byte, 0, 64*1024), 8<<20)
	var wmu sync.Mutex
	for {
		req, err := rpc.ReadLine(sc)
		if err != nil {
			d.dropBridge(conn)
			return
		}
		resp := d.dispatch(conn, &wmu, req)
		if resp == nil {
			continue
		}
		if err := rpc.WriteLine(conn, &wmu, resp); err != nil {
			d.dropBridge(conn)
			return
		}
	}
}

func (d *Daemon) dispatch(conn net.Conn, wmu *sync.Mutex, req *rpc.Request) *rpc.Response {
	switch req.Method {
	case "hello":
		var p rpc.HelloParams
		_ = json.Unmarshal(req.Params, &p)
		if p.Role == "bridge" {
			d.mu.Lock()
			d.bridges[conn] = &bridge{conn: conn, mu: wmu}
			d.extHello = time.Now()
			d.mu.Unlock()
		}
		return &rpc.Response{ID: req.ID, OK: true}
	case "from-extension":
		return d.fromExtension(req)
	case "pin":
		return d.pinRequest(req)
	case "latest":
		return d.latestResponse(req.ID)
	case "session":
		return d.sessionResponse(req.ID)
	case "unpin":
		return d.unpinRequest(req)
	case "done":
		return d.doneRequest(req)
	case "list":
		return d.sessionResponse(req.ID)
	case "wait":
		return d.wait(req)
	case "arm":
		if err := d.arm(); err != nil {
			return &rpc.Response{ID: req.ID, OK: false, Error: err.Error()}
		}
		return &rpc.Response{ID: req.ID, OK: true}
	case "status":
		return &rpc.Response{ID: req.ID, OK: true, Status: d.status()}
	default:
		return &rpc.Response{ID: req.ID, OK: false, Error: "unknown method " + req.Method}
	}
}

func (d *Daemon) fromExtension(req *rpc.Request) *rpc.Response {
	var msg map[string]any
	if err := json.Unmarshal(req.Params, &msg); err != nil {
		return &rpc.Response{ID: req.ID, OK: false, Error: err.Error()}
	}
	typ, _ := msg["type"].(string)
	switch typ {
	case "hello":
		d.mu.Lock()
		d.extHello = time.Now()
		d.mu.Unlock()
		return &rpc.Response{ID: req.ID, OK: true}
	case "pin":
		raw, _ := json.Marshal(msg)
		var p rpc.PinParams
		_ = json.Unmarshal(raw, &p)
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
			return &rpc.Response{ID: req.ID, OK: false, Error: err.Error()}
		}
		return &rpc.Response{ID: req.ID, OK: true, Pin: pin}
	default:
		return &rpc.Response{ID: req.ID, OK: true}
	}
}

func (d *Daemon) pinRequest(req *rpc.Request) *rpc.Response {
	var p rpc.PinParams
	if err := json.Unmarshal(req.Params, &p); err != nil {
		return &rpc.Response{ID: req.ID, OK: false, Error: err.Error()}
	}
	pin, err := d.savePin(p)
	if err != nil {
		return &rpc.Response{ID: req.ID, OK: false, Error: err.Error()}
	}
	return &rpc.Response{ID: req.ID, OK: true, Pin: pin}
}

func (d *Daemon) savePin(p rpc.PinParams) (*payload.Pin, error) {
	var pin payload.Pin
	if len(p.Payload) > 0 {
		if err := json.Unmarshal(p.Payload, &pin); err != nil {
			return nil, err
		}
	}
	if pin.ID == "" {
		pin.ID = newID()
	}
	pin.TS = time.Now().UTC()
	mime := p.MIME
	if mime == "" {
		mime = "image/png"
	}
	pin.ScreenshotMIME = mime
	if err := paths.EnsureHome(); err != nil {
		return nil, err
	}
	if p.PngBase64 != "" {
		raw, err := base64.StdEncoding.DecodeString(p.PngBase64)
		if err != nil {
			return nil, fmt.Errorf("screenshot: %w", err)
		}
		if err := os.WriteFile(paths.LatestPNG(), raw, 0o600); err != nil {
			return nil, err
		}
		pin.ScreenshotPath = paths.LatestPNG()
		histPNG := filepath.Join(paths.HistoryDir(), pin.ID+".png")
		_ = os.WriteFile(histPNG, raw, 0o600)
	}
	if err := pin.MarshalJSONFile(paths.LatestJSON()); err != nil {
		return nil, err
	}
	_ = pin.MarshalJSONFile(filepath.Join(paths.HistoryDir(), pin.ID+".json"))
	pruneHistory()

	d.mu.Lock()
	if d.session.Ready || d.session.ID == "" {
		d.session = payload.NewSession()
	}
	d.session.Pins = append(d.session.Pins, pin)
	d.latest = &pin
	waiters := d.waiters
	d.waiters = nil
	sess := d.session
	d.mu.Unlock()
	_ = sess.Write(paths.SessionJSON())
	for _, ch := range waiters {
		select {
		case ch <- pin:
		default:
		}
	}
	cp := pin
	return &cp, nil
}

func (d *Daemon) latestResponse(id string) *rpc.Response {
	d.mu.Lock()
	defer d.mu.Unlock()
	if len(d.session.Pins) > 0 {
		cp := d.session.Pins[len(d.session.Pins)-1]
		return &rpc.Response{ID: id, OK: true, Pin: &cp, Pins: append([]payload.Pin(nil), d.session.Pins...)}
	}
	if d.latest == nil {
		return &rpc.Response{ID: id, OK: false, Error: "no element pinned yet"}
	}
	cp := *d.latest
	return &rpc.Response{ID: id, OK: true, Pin: &cp}
}

func (d *Daemon) sessionResponse(id string) *rpc.Response {
	d.mu.Lock()
	defer d.mu.Unlock()
	if len(d.session.Pins) == 0 {
		return &rpc.Response{ID: id, OK: false, Error: "no element pinned yet"}
	}
	pins := append([]payload.Pin(nil), d.session.Pins...)
	last := pins[len(pins)-1]
	return &rpc.Response{ID: id, OK: true, Pin: &last, Pins: pins}
}

func (d *Daemon) unpinRequest(req *rpc.Request) *rpc.Response {
	var p struct {
		ID string `json:"id"`
	}
	_ = json.Unmarshal(req.Params, &p)
	if p.ID == "" {
		return &rpc.Response{ID: req.ID, OK: false, Error: "missing id"}
	}
	d.mu.Lock()
	out := d.session.Pins[:0]
	for _, pin := range d.session.Pins {
		if pin.ID != p.ID {
			out = append(out, pin)
		}
	}
	d.session.Pins = out
	if len(d.session.Pins) > 0 {
		last := d.session.Pins[len(d.session.Pins)-1]
		d.latest = &last
	} else {
		d.latest = nil
	}
	sess := d.session
	d.mu.Unlock()
	_ = sess.Write(paths.SessionJSON())
	return &rpc.Response{ID: req.ID, OK: true, Pins: sess.Pins}
}

func (d *Daemon) doneRequest(req *rpc.Request) *rpc.Response {
	d.mu.Lock()
	if len(d.session.Pins) == 0 {
		d.mu.Unlock()
		return &rpc.Response{ID: req.ID, OK: false, Error: "no pins"}
	}
	now := time.Now().UTC()
	d.session.Ready = true
	d.session.ReadyAt = &now
	d.session.Injected = false
	pins := append([]payload.Pin(nil), d.session.Pins...)
	sess := d.session
	doneWaiters := d.doneWaiters
	d.doneWaiters = nil
	d.mu.Unlock()
	_ = sess.Write(paths.SessionJSON())
	for _, ch := range doneWaiters {
		select {
		case ch <- pins:
		default:
		}
	}
	return &rpc.Response{
		ID:   req.ID,
		OK:   true,
		Pins: pins,
		Text: payload.ClipboardMessage(pins),
	}
}

func (d *Daemon) wait(req *rpc.Request) *rpc.Response {
	var p rpc.WaitParams
	_ = json.Unmarshal(req.Params, &p)
	timeout := time.Duration(p.TimeoutSec) * time.Second
	if timeout <= 0 {
		timeout = 120 * time.Second
	}
	if timeout > 5*time.Minute {
		timeout = 5 * time.Minute
	}
	if err := d.armWithRetry(3 * time.Second); err != nil {
		return &rpc.Response{ID: req.ID, OK: false, Error: err.Error()}
	}
	d.mu.Lock()
	if d.session.FreshReady(2*time.Minute) && len(d.session.Pins) > 0 {
		pins := append([]payload.Pin(nil), d.session.Pins...)
		last := pins[len(pins)-1]
		d.mu.Unlock()
		return &rpc.Response{ID: req.ID, OK: true, Pin: &last, Pins: pins}
	}
	ch := make(chan []payload.Pin, 1)
	d.doneWaiters = append(d.doneWaiters, ch)
	d.mu.Unlock()
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case pins := <-ch:
		last := pins[len(pins)-1]
		return &rpc.Response{ID: req.ID, OK: true, Pin: &last, Pins: pins}
	case <-timer.C:
		d.mu.Lock()
		filtered := d.doneWaiters[:0]
		for _, w := range d.doneWaiters {
			if w != ch {
				filtered = append(filtered, w)
			}
		}
		d.doneWaiters = filtered
		d.mu.Unlock()
		return &rpc.Response{ID: req.ID, OK: false, Error: "timed out. Pin in the InspectAI panel and hit Done."}
	}
}

func (d *Daemon) armWithRetry(budget time.Duration) error {
	deadline := time.Now().Add(budget)
	var err error
	for {
		err = d.arm()
		if err == nil {
			return nil
		}
		if time.Now().After(deadline) {
			return err
		}
		time.Sleep(200 * time.Millisecond)
	}
}

func (d *Daemon) arm() error {
	d.mu.Lock()
	n := len(d.bridges)
	bridges := make([]*bridge, 0, n)
	for _, b := range d.bridges {
		bridges = append(bridges, b)
	}
	httpWaiters := d.httpArm
	d.httpArm = nil
	d.mu.Unlock()
	if n == 0 && len(httpWaiters) == 0 {
		return fmt.Errorf("extension not connected — click the InspectAI toolbar icon")
	}
	for _, ch := range httpWaiters {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
	msg := rpc.Response{OK: true, Method: "event", Type: "arm"}
	var last error
	for _, b := range bridges {
		if err := rpc.WriteLine(b.conn, b.mu, msg); err != nil {
			last = err
			d.dropBridge(b.conn)
		}
	}
	return last
}

func (d *Daemon) dropBridge(conn net.Conn) {
	d.mu.Lock()
	delete(d.bridges, conn)
	d.mu.Unlock()
}

func (d *Daemon) status() *rpc.Status {
	d.mu.Lock()
	defer d.mu.Unlock()
	connected := len(d.bridges) > 0 || len(d.httpArm) > 0 || (!d.extHello.IsZero() && time.Since(d.extHello) < 45*time.Second)
	st := &rpc.Status{Running: true, ExtensionConnected: connected}
	if d.latest != nil {
		st.LastPinAgeSec = int64(time.Since(d.latest.TS).Seconds())
		st.LastSelector = d.latest.Selector
		st.LastURL = d.latest.URL
	}
	return st
}

func listHistory() ([]payload.Pin, error) {
	entries, err := os.ReadDir(paths.HistoryDir())
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var pins []payload.Pin
	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".json" {
			continue
		}
		p, err := payload.ReadFile(filepath.Join(paths.HistoryDir(), e.Name()))
		if err != nil {
			continue
		}
		p.OuterHTML = ""
		p.Styles = nil
		pins = append(pins, p)
	}
	return pins, nil
}

func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("%x", b[:])
}

func pruneHistory() {
	entries, err := os.ReadDir(paths.HistoryDir())
	if err != nil {
		return
	}
	type item struct {
		name string
		mod  time.Time
	}
	var jsons []item
	for _, e := range entries {
		if filepath.Ext(e.Name()) != ".json" {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		jsons = append(jsons, item{name: e.Name(), mod: info.ModTime()})
	}
	if len(jsons) <= historyKeep {
		return
	}
	// sort oldest first
	for i := 0; i < len(jsons); i++ {
		for j := i + 1; j < len(jsons); j++ {
			if jsons[j].mod.Before(jsons[i].mod) {
				jsons[i], jsons[j] = jsons[j], jsons[i]
			}
		}
	}
	drop := jsons[:len(jsons)-historyKeep]
	for _, it := range drop {
		base := filepath.Join(paths.HistoryDir(), it.name)
		_ = os.Remove(base)
		_ = os.Remove(base[:len(base)-5] + ".png")
	}
}

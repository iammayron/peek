package rpc

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"sync"
	"sync/atomic"
	"time"

	"github.com/iammayron/peek/internal/paths"
	"github.com/iammayron/peek/internal/payload"
)

type Request struct {
	ID     string          `json:"id"`
	Method string          `json:"method"`
	Params json.RawMessage `json:"params,omitempty"`
}

type Status struct {
	Running            bool   `json:"running"`
	ExtensionConnected bool   `json:"extensionConnected"`
	LastPinAgeSec      int64  `json:"lastPinAgeSec,omitempty"`
	LastSelector       string `json:"lastSelector,omitempty"`
	LastURL            string `json:"lastURL,omitempty"`
}

type Response struct {
	ID     string        `json:"id,omitempty"`
	OK     bool          `json:"ok"`
	Error  string        `json:"error,omitempty"`
	Method string        `json:"method,omitempty"`
	Pin    *payload.Pin  `json:"pin,omitempty"`
	Pins   []payload.Pin `json:"pins,omitempty"`
	Status *Status       `json:"status,omitempty"`
	Type   string        `json:"type,omitempty"`
	Text   string        `json:"text,omitempty"`
}

type PinParams struct {
	Payload   json.RawMessage `json:"payload"`
	PngBase64 string          `json:"pngBase64"`
	MIME      string          `json:"mime,omitempty"`
}

type WaitParams struct {
	TimeoutSec int `json:"timeoutSec"`
}

type HelloParams struct {
	Role        string `json:"role"`
	ExtensionID string `json:"extensionId,omitempty"`
}

type Client struct {
	conn net.Conn
	sc   *bufio.Scanner
	wmu  sync.Mutex
	rmu  sync.Mutex
	seq  atomic.Uint64
}

func Dial(timeout time.Duration) (*Client, error) {
	d := net.Dialer{Timeout: timeout}
	c, err := d.Dial("unix", paths.Socket())
	if err != nil {
		return nil, err
	}
	sc := bufio.NewScanner(c)
	sc.Buffer(make([]byte, 0, 64*1024), 8<<20)
	return &Client{conn: c, sc: sc}, nil
}

func (c *Client) Close() error { return c.conn.Close() }

func (c *Client) Recv() (*Response, error) {
	c.rmu.Lock()
	defer c.rmu.Unlock()
	if !c.sc.Scan() {
		if err := c.sc.Err(); err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("daemon closed connection")
	}
	var resp Response
	if err := json.Unmarshal(c.sc.Bytes(), &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) Call(method string, params any, timeout time.Duration) (*Response, error) {
	id := fmt.Sprintf("%d", c.seq.Add(1))
	var raw json.RawMessage
	if params != nil {
		b, err := json.Marshal(params)
		if err != nil {
			return nil, err
		}
		raw = b
	}
	req := Request{ID: id, Method: method, Params: raw}
	b, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	b = append(b, '\n')
	if timeout > 0 {
		_ = c.conn.SetDeadline(time.Now().Add(timeout))
		defer c.conn.SetDeadline(time.Time{})
	}
	c.wmu.Lock()
	_, err = c.conn.Write(b)
	c.wmu.Unlock()
	if err != nil {
		return nil, err
	}
	resp, err := c.Recv()
	if err != nil {
		return nil, err
	}
	if !resp.OK {
		if resp.Error == "" {
			resp.Error = "request failed"
		}
		return resp, fmt.Errorf("%s", resp.Error)
	}
	return resp, nil
}

func WriteLine(c net.Conn, mu *sync.Mutex, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	b = append(b, '\n')
	if mu != nil {
		mu.Lock()
		defer mu.Unlock()
	}
	_, err = c.Write(b)
	return err
}

func ReadLine(sc *bufio.Scanner) (*Request, error) {
	if !sc.Scan() {
		if err := sc.Err(); err != nil {
			return nil, err
		}
		return nil, os.ErrClosed
	}
	var req Request
	if err := json.Unmarshal(sc.Bytes(), &req); err != nil {
		return nil, err
	}
	return &req, nil
}

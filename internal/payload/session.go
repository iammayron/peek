package payload

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"
)

type Session struct {
	ID       string     `json:"id"`
	Pins     []Pin      `json:"pins"`
	Ready    bool       `json:"ready"`
	ReadyAt  *time.Time `json:"readyAt,omitempty"`
	Injected bool       `json:"injected,omitempty"`
}

func NewSession() Session {
	return Session{ID: fmt.Sprintf("%d", time.Now().UnixNano()), Pins: []Pin{}}
}

func ReadSession(path string) (Session, error) {
	var s Session
	data, err := os.ReadFile(path)
	if err != nil {
		return s, err
	}
	err = json.Unmarshal(data, &s)
	return s, err
}

func (s Session) Write(path string) error {
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func (s Session) FreshReady(maxAge time.Duration) bool {
	if !s.Ready || s.Injected || s.ReadyAt == nil {
		return false
	}
	return time.Since(*s.ReadyAt) <= maxAge
}

func SessionMarkdown(pins []Pin) string {
	if len(pins) == 0 {
		return "No Peek pins."
	}
	if len(pins) == 1 {
		return pins[0].Markdown()
	}
	md := "# Peek pinned " + strconv.Itoa(len(pins)) + " elements\n\n"
	for i, p := range pins {
		label := p.Name
		if label == "" {
			label = p.Tag
		}
		md += fmt.Sprintf("## %d. `%s` — %s\n\n", i+1, p.Selector, label)
		md += "- URL: " + p.URL + "\n"
		md += "- Selector (`" + p.Strategy + "`): `" + p.Selector + "`\n"
		if p.ScreenshotPath != "" {
			md += "- Screenshot: `" + p.ScreenshotPath + "`\n"
		}
		if p.OuterHTML != "" {
			md += "\n```html\n" + p.OuterHTML + "\n```\n"
		}
		md += "\n"
	}
	return md
}

func ClipboardMessage(pins []Pin) string {
	n := len(pins)
	noun := "element"
	if n != 1 {
		noun = "elements"
	}
	return "Take a peek at " + strconv.Itoa(n) + " " + noun + ". I want to "
}

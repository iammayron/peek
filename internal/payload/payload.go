package payload

import (
	"encoding/json"
	"os"
	"time"
)

type Rect struct {
	X   float64 `json:"x"`
	Y   float64 `json:"y"`
	W   float64 `json:"w"`
	H   float64 `json:"h"`
	VW  float64 `json:"vw"`
	VH  float64 `json:"vh"`
	DPR float64 `json:"dpr"`
}

type Pin struct {
	ID                  string            `json:"id"`
	TS                  time.Time         `json:"ts"`
	URL                 string            `json:"url"`
	Title               string            `json:"title"`
	Selector            string            `json:"selector"`
	Strategy            string            `json:"strategy,omitempty"`
	XPath               string            `json:"xpath"`
	Tag                 string            `json:"tag"`
	IDAttr              string            `json:"idAttr,omitempty"`
	Classes             []string          `json:"classes,omitempty"`
	Role                string            `json:"role,omitempty"`
	Name                string            `json:"name,omitempty"`
	InnerText           string            `json:"innerText,omitempty"`
	OuterHTML           string            `json:"outerHTML,omitempty"`
	InShadow            bool              `json:"inShadow,omitempty"`
	Rect                Rect              `json:"rect"`
	Styles              map[string]string `json:"styles,omitempty"`
	ScreenshotPaddingPx int               `json:"screenshotPaddingPx,omitempty"`
	Clipped             bool              `json:"clipped,omitempty"`
	ScreenshotPath      string            `json:"screenshotPath,omitempty"`
	ScreenshotMIME      string            `json:"screenshotMime,omitempty"`
	TabID               int               `json:"tabId,omitempty"`
	WindowID            int               `json:"windowId,omitempty"`
}

func (p Pin) MarshalJSONFile(path string) error {
	data, err := json.MarshalIndent(p, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func ReadFile(path string) (Pin, error) {
	var p Pin
	data, err := os.ReadFile(path)
	if err != nil {
		return p, err
	}
	err = json.Unmarshal(data, &p)
	return p, err
}

func (p Pin) Markdown() string {
	name := p.Name
	if name == "" {
		name = "(none)"
	}
	md := "# Pinned element\n\n"
	md += "- URL: " + p.URL + "\n"
	md += "- Title: " + p.Title + "\n"
	md += "- Selector (`" + p.Strategy + "`): `" + p.Selector + "`\n"
	md += "- XPath: `" + p.XPath + "`\n"
	md += "- Tag: `" + p.Tag + "`"
	if p.IDAttr != "" {
		md += " id=`" + p.IDAttr + "`"
	}
	md += "\n"
	md += "- Role: " + p.Role + " — " + name + "\n"
	if p.InShadow {
		md += "- Shadow DOM: yes\n"
	}
	if p.Clipped {
		md += "- Screenshot clipped to viewport\n"
	}
	if p.ScreenshotPath != "" {
		md += "- Screenshot: `" + p.ScreenshotPath + "`\n"
	}
	if p.OuterHTML != "" {
		md += "\n```html\n" + p.OuterHTML + "\n```\n"
	}
	return md
}

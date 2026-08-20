package nativemsg

import (
	"bytes"
	"testing"
)

func TestRoundTrip(t *testing.T) {
	payload := []byte(`{"type":"pin","hello":true}`)
	var buf bytes.Buffer
	if err := Write(&buf, payload); err != nil {
		t.Fatal(err)
	}
	got, err := Read(&buf)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(payload) {
		t.Fatalf("got %s", got)
	}
}

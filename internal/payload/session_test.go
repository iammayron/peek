package payload

import "testing"

func TestClipboardMessage(t *testing.T) {
	t.Parallel()
	got := ClipboardMessage([]Pin{{}})
	want := "Take a peek at 1 element. I want to "
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
	got = ClipboardMessage([]Pin{{}, {}})
	want = "Take a peek at 2 elements. I want to "
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

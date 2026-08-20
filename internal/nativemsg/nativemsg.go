package nativemsg

import (
	"encoding/binary"
	"fmt"
	"io"
)

const maxMessage = 1024 * 1024

func Read(r io.Reader) ([]byte, error) {
	var n uint32
	if err := binary.Read(r, binary.LittleEndian, &n); err != nil {
		return nil, err
	}
	if n > maxMessage {
		return nil, fmt.Errorf("native message too large: %d", n)
	}
	buf := make([]byte, n)
	if _, err := io.ReadFull(r, buf); err != nil {
		return nil, err
	}
	return buf, nil
}

func Write(w io.Writer, b []byte) error {
	if len(b) > maxMessage {
		return fmt.Errorf("native message too large: %d", len(b))
	}
	if err := binary.Write(w, binary.LittleEndian, uint32(len(b))); err != nil {
		return err
	}
	_, err := w.Write(b)
	return err
}

package main

import (
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
)

func main() {
	out := "extension/icons"
	if len(os.Args) > 1 {
		out = os.Args[1]
	}
	if err := os.MkdirAll(out, 0o755); err != nil {
		panic(err)
	}
	for _, size := range []int{16, 48, 128} {
		img := render(size)
		f, err := os.Create(filepath.Join(out, "icon-"+itoa(size)+".png"))
		if err != nil {
			panic(err)
		}
		if err := png.Encode(f, img); err != nil {
			panic(err)
		}
		_ = f.Close()
	}
}

func render(size int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	bg := color.RGBA{0x16, 0x14, 0x0F, 0xFF}
	lime := color.RGBA{0xC8, 0xFF, 0x4D, 0xFF}
	ink := color.RGBA{0x16, 0x14, 0x0F, 0xFF}

	r := size / 5
	fillRoundRect(img, 0, 0, size-1, size-1, r, bg)

	cx, cy := size/2, size/2
	outer := size * 38 / 100
	inner := size * 12 / 100
	thick := max(1, size/16)

	drawCircle(img, cx, cy, outer, thick, lime)
	// crosshair ticks
	gap := inner + thick
	for t := 0; t < thick; t++ {
		hLine(img, cx-outer, cx-gap, cy+t, lime)
		hLine(img, cx+gap, cx+outer, cy+t, lime)
		vLine(img, cy-outer, cy-gap, cx+t, lime)
		vLine(img, cy+gap, cy+outer, cx+t, lime)
		if t > 0 {
			hLine(img, cx-outer, cx-gap, cy-t, lime)
			hLine(img, cx+gap, cx+outer, cy-t, lime)
			vLine(img, cy-outer, cy-gap, cx-t, lime)
			vLine(img, cy+gap, cy+outer, cx-t, lime)
		}
	}
	drawFilledCircle(img, cx, cy, max(1, size/14), lime)
	if size >= 48 {
		drawFilledCircle(img, cx, cy, max(1, size/28), ink)
	}
	return img
}

func fillRoundRect(img *image.RGBA, x0, y0, x1, y1, rad int, c color.RGBA) {
	for y := y0; y <= y1; y++ {
		for x := x0; x <= x1; x++ {
			if insideRoundRect(x, y, x0, y0, x1, y1, rad) {
				img.SetRGBA(x, y, c)
			}
		}
	}
}

func insideRoundRect(x, y, x0, y0, x1, y1, r int) bool {
	if x >= x0+r && x <= x1-r {
		return y >= y0 && y <= y1
	}
	if y >= y0+r && y <= y1-r {
		return x >= x0 && x <= x1
	}
	cx, cy := x0+r, y0+r
	switch {
	case x < x0+r && y < y0+r:
	case x > x1-r && y < y0+r:
		cx = x1 - r
	case x < x0+r && y > y1-r:
		cy = y1 - r
	default:
		cx, cy = x1-r, y1-r
	}
	dx, dy := x-cx, y-cy
	return dx*dx+dy*dy <= r*r
}

func drawCircle(img *image.RGBA, cx, cy, radius, thick int, c color.RGBA) {
	r2 := radius * radius
	rIn := radius - thick
	if rIn < 0 {
		rIn = 0
	}
	in2 := rIn * rIn
	for y := cy - radius; y <= cy+radius; y++ {
		for x := cx - radius; x <= cx+radius; x++ {
			d := (x-cx)*(x-cx) + (y-cy)*(y-cy)
			if d <= r2 && d >= in2 {
				img.SetRGBA(x, y, c)
			}
		}
	}
}

func drawFilledCircle(img *image.RGBA, cx, cy, radius int, c color.RGBA) {
	r2 := radius * radius
	for y := cy - radius; y <= cy+radius; y++ {
		for x := cx - radius; x <= cx+radius; x++ {
			if (x-cx)*(x-cx)+(y-cy)*(y-cy) <= r2 {
				img.SetRGBA(x, y, c)
			}
		}
	}
}

func hLine(img *image.RGBA, x0, x1, y int, c color.RGBA) {
	if x0 > x1 {
		x0, x1 = x1, x0
	}
	for x := x0; x <= x1; x++ {
		img.SetRGBA(x, y, c)
	}
}

func vLine(img *image.RGBA, y0, y1, x int, c color.RGBA) {
	if y0 > y1 {
		y0, y1 = y1, y0
	}
	for y := y0; y <= y1; y++ {
		img.SetRGBA(x, y, c)
	}
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [8]byte
	i := len(b)
	for n > 0 {
		i--
		b[i] = byte('0' + n%10)
		n /= 10
	}
	return string(b[i:])
}

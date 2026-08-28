# Chrome Web Store assets

Listing for item `afalnlminndnlfgnlphbelelpcblcbld` (publisher `iammayron`).

The store rejects a manifest containing `key`, so the uploaded zip is built from a
copy of `extension/` with that field stripped:

```sh
rm -rf /tmp/peek-pkg && cp -R extension /tmp/peek-pkg
python3 -c "import json,pathlib,collections;p=pathlib.Path('/tmp/peek-pkg/manifest.json');\
m=json.loads(p.read_text(),object_pairs_hook=collections.OrderedDict);m.pop('key',None);\
p.write_text(json.dumps(m,indent=2)+'\n')"
cd /tmp/peek-pkg && zip -rq /tmp/peek.zip . -x "*.DS_Store"
```

## Promo tiles

`promo.html` is the source for both. It sizes itself to the window, so the render
flag picks the format:

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
# small tile: render at 2x, downscale for crisp text
"$CHROME" --headless --disable-gpu --screenshot=/tmp/s.png --window-size=880,560 \
  --hide-scrollbars "file://$PWD/assets/store/promo.html"
magick /tmp/s.png -resize 440x280 -alpha off PNG24:assets/store/promo-small-440x280.png
# marquee tile
"$CHROME" --headless --disable-gpu --screenshot=/tmp/m.png --window-size=1400,560 \
  --hide-scrollbars "file://$PWD/assets/store/promo.html"
magick /tmp/m.png -alpha off PNG24:assets/store/promo-marquee-1400x560.png
```

The store demands JPEG or 24-bit PNG with no alpha, hence `-alpha off PNG24:`.

## Screenshots

The three 1280x800 shots are the docked rail running over `testdata/pages/fixture.html`.
Serve the repo root (`python3 -m http.server 8899`), open the fixture at a 1280x800
viewport, then inject the actual content scripts with a stub for the one API they
need from the service worker:

```js
globalThis.chrome = { runtime: {
  sendMessage: async (m) => m.type === 'peek:pin' ? { ok: true, id: 'p1' }
    : m.type === 'peek:done' ? { ok: true, text: '...' } : { ok: true },
  onMessage: { addListener() {} },
} }
// then load /extension/content/selector.js and /extension/content/picker.js,
// call globalThis.__peek.arm(), hover and click elements, and capture.
```

Hover an element for the highlight ticks, click to add rail pills with thumbs, press
Done for the copied toast. Flatten each capture the same way as the tiles.

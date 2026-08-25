# Peek website

Public landing for [Peek](https://github.com/iammayron/peek). Canonical origin: **https://peek.mayronalves.com**.

This app lives in `website/` so the Go daemon, Chrome extension, and install scripts stay untouched. All Next.js and Remotion dependencies are in `website/package.json`.

The production build is a **static export** (`output: 'export'`). Cloudflare Pages serves `out/`; there is no Node server at request time. The OG image and Remotion MP4 are committed under `public/`.

## Local

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Static export (what Pages deploys):

```bash
npm run build
npm run preview
```

## Remotion demo

The hero video is a stylized 16s composition (generic browser, pin, terminal paste). Source is in `remotion/`. It is not a recording of Peek.

The landing reads `public/demo.mp4` and `public/demo-poster.png`. Those are already in git, so a Pages build does **not** need Chrome or Remotion. Re-render locally only if you change the composition:

```bash
cd website
npm run remotion
npx remotion render remotion/index.ts PeekDemo public/demo.mp4
npx remotion still remotion/index.ts PeekDemo public/demo-poster.png --frame=150
```

If Remotion cannot find Chrome:

```bash
npx remotion render remotion/index.ts PeekDemo public/demo.mp4 \
  --browser-executable "$(command -v google-chrome || command -v chrome || command -v chromium)"
```

`npm run render` and `npm run still` wrap those commands.

OG artwork source is `scripts/og.html` (committed PNG: `public/og-image.png`).

## Cloudflare Pages

Create a Pages project on this GitHub repo (not a Vercel app). Settings:

| Setting | Value |
|---|---|
| Project root / Root directory | `website` |
| Build command | `npm run build` |
| Output directory | `out` |
| Custom domain | `peek.mayronalves.com` |

Attach **peek.mayronalves.com** in the Pages project’s Custom domains UI. Do not treat this README as DNS instructions.

Optional deploy from `website/` after a local `npm run build`:

```bash
npx wrangler pages deploy out
```

Pass `--project-name` if Wrangler should target an existing Pages project instead of creating one.

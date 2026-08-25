# Peek website

Public landing for [Peek](https://github.com/iammayron/peek). Canonical origin: **https://peek.mayronalves.com**.

This app lives in `website/` so the Go daemon, Chrome extension, and install scripts stay untouched. All Next.js and Remotion dependencies are in `website/package.json`.

## Local

```bash
cd website
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build
npm start
```

## Remotion demo

The hero video is a stylized 16s composition (generic browser, pin, terminal paste). Source is in `remotion/`. It is not a recording of Peek.

Studio:

```bash
cd website
npm run remotion
```

Render the MP4 used by the landing (from `website/`):

```bash
npx remotion render remotion/index.ts PeekDemo public/demo.mp4
```

Poster still (frame 150, hover+chip):

```bash
npx remotion still remotion/index.ts PeekDemo public/demo-poster.png --frame=150
```

If Remotion cannot find Chrome:

```bash
npx remotion render remotion/index.ts PeekDemo public/demo.mp4 \
  --browser-executable "$(command -v google-chrome || command -v chrome || command -v chromium)"
```

`npm run render` and `npm run still` wrap those commands.

## Vercel

Create a project on this repo and set **Root Directory** to `website`. Vercel will pick up `website/vercel.json` (`framework: nextjs`) and `website/package.json`. Production URL should be `https://peek.mayronalves.com`. Do not set the repo root as the Next app; that would fight the Go tree.

# @classcast/video-effects

This package hosts the browser-side background effects engine that produces processed `MediaStreamTrack` instances (blur, replacement, chroma key, etc.).

## Current status

- Public interfaces (`BgEffect`, `createBgEffect`) are being defined.
- A mock engine and MediaPipe-based implementation are planned.
- A demo harness (`demo/index.html`) exercises the engine in isolation while UI work continues independently.

## Local development

1. Install dependencies from the repository root: `npm install`.
2. Run the demo harness (to be wired shortly) from this folder once the Vite config lands.

The main app will consume the engine through the stable track-based API exposed by `src/index.ts`.

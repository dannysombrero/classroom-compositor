# @classcast/video-effects

This package hosts the browser-side background effects engine that produces processed `MediaStreamTrack` instances (blur, replacement, chroma key, etc.).

## Current status

- Stable public interfaces (`BgEffect`, `createBgEffect`) are defined and exported.
- A pipeline scaffold (`src/pipeline/*`) captures the contracts for the segmenter, compositor, and Insertable Streams loop.
- The current implementation uses an Insertable Streams pipeline with placeholder segmentation/compositing (outputs the raw frame for now).
- A Vite-powered demo harness (`npm run --prefix packages/video-effects demo`) previews the processed track for manual testing.

## Local development

1. Install dependencies from the repository root: `npm install`.
2. Build the package: `npm run --prefix packages/video-effects build`.
3. Run the demo harness: `npm run --prefix packages/video-effects demo`.
   - The demo opens a camera stream, routes it through the pass-through pipeline, and previews the resulting track.

The main app will consume the engine through the stable track-based API exposed by `src/index.ts`.

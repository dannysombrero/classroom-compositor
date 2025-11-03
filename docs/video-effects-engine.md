# Video Effects Engine (Background Removal / Chroma Key)

This document tracks the implementation status of the browser-side video effects engine that produces processed `MediaStreamTrack` instances for the presenter experience.

## Current state (2025-02)

- `packages/video-effects` now builds via `tsc -p tsconfig.build.json`, and the demo harness runs through a local Vite config.
- `createBgEffect()` delegates to a background-effect pipeline stub that will be replaced by the real Insertable Streams loop.
- Pipeline interfaces for segmenters and compositors (`src/pipeline/*`) define the contract for forthcoming implementations, with an Insertable Streams pass-through pipeline already producing a derived track.
- Demo harness (`packages/video-effects/demo`) boots the mock engine, routes the camera through the pass-through pipeline, and previews the processed track for manual testing.

## Immediate next steps

1. **MediaPipe adapter:** Stand up `src/adapters/mediapipe.ts` that loads the portrait segmentation model, normalises masks, and exposes the shared `ISegmenter` interface.
2. **Pipeline loop:** Implement `src/pipeline/stream.ts` using Insertable Streams (`MediaStreamTrackProcessor`/`Generator`) with a basic compositor that blends the source frame + segmentation mask.
3. **Compositor implementation:** Replace the current pass-through compositor with WebGL/WebGPU shaders (blur, replacement, chroma) and CPU fallback.
4. **Mock/UI integration:** Keep a trivial mock export for unit/UI tests once the real engine is live, and expose configuration hooks to the Presenter UI.
5. **Testing:** Add unit tests for smoothing utilities and mask post-processing; extend the demo harness to surface frame timing telemetry.

## Longer-term considerations

- Introduce ONNX Runtime Web support for higher-fidelity segmentation (MODNet/RVM) gated by the `engine` option.
- Add chroma-key shader path that bypasses ML when users opt for a pure color key.
- Surface feature flags inside the main app so the Presenter page can choose between the raw camera track and the processed track at runtime.
- Track model licensing and delivery requirements (`assets/models/*`).

This file should be updated as milestones land so the UI team knows which capabilities are safe to integrate.

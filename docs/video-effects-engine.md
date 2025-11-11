# Video Effects Engine (Background Removal / Chroma Key)

This document tracks the implementation status of the browser-side video effects engine that produces processed `MediaStreamTrack` instances for the presenter experience.

## Current state (2025-02)

- `packages/video-effects` now builds via `tsc -p tsconfig.build.json`, and the demo harness runs through a local Vite config.
- `createBgEffect()` delegates to a background-effect pipeline stub that will be replaced by the real Insertable Streams loop.
- Pipeline interfaces for segmenters and compositors (`src/pipeline/*`) define the contract for forthcoming implementations, with an Insertable Streams pipeline already handling frame scheduling (currently returns the raw frame until shaders/segmentation are wired).
- Demo harness (`packages/video-effects/demo`) boots the mock engine, routes the camera through the pass-through pipeline, and previews the processed track for manual testing.
- MediaPipe adapter scaffold returns an all-foreground mask for now; real model integration is the next major milestone.
- Smoothing/telemetry scaffolding is being prepared so the segmentation loop can reuse mask utilities and surface FPS metrics once implemented.

## Immediate next steps

1. **MediaPipe adapter:** Stand up `src/adapters/mediapipe.ts` that loads the portrait segmentation model, normalises masks, and exposes the shared `ISegmenter` interface. Draft API hooks are ready; add lazy loader, model path config, and convert float masks to RGBA textures.
2. **Smoothing utilities:** Finalise `src/pipeline/smoothing.ts` to host temporal EMA and morphological helpers used by adapters/pipeline. Define `emaSmoothMask`, `refineMask`, and unit-test the numerical stability.
3. **Compositor implementation:** Replace the current pass-through compositor with WebGL/WebGPU shaders (blur, replacement, chroma) and CPU fallback. Stub shader modules and pipeline setup so the real implementation can slot in.
4. **Telemetry harness:** Extend the demo page with processing stats (frame time, inference cadence) so perf regressions are visible during development.
5. **Testing strategy:** Document unit/integration test plan (mask smoothing, compositor shaders, pipeline frame loop) and add initial Vitest scaffolding.
6. **Mock/UI integration:** Keep a trivial mock export for unit/UI tests once the real engine is live, and expose configuration hooks to the Presenter UI. Add feature flag toggle in `PresenterPage`.

## Longer-term considerations

- Introduce ONNX Runtime Web support for higher-fidelity segmentation (MODNet/RVM) gated by the `engine` option.
- Add chroma-key shader path that bypasses ML when users opt for a pure color key.
- Surface feature flags inside the main app so the Presenter page can choose between the raw camera track and the processed track at runtime.
- Track model licensing and delivery requirements (`assets/models/*`).

This file should be updated as milestones land so the UI team knows which capabilities are safe to integrate.

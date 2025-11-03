# Video Effects Engine (Background Removal / Chroma Key)

This document tracks the implementation status of the browser-side video effects engine that produces processed `MediaStreamTrack` instances for the presenter experience.

## Current state (2025-02)

- `packages/video-effects` scaffolding landed with TypeScript interfaces and a `createBgEffect()` mock implementation that currently passes the source track through untouched.
- Demo harness (`packages/video-effects/demo`) obtains a camera stream and is ready to host the engine pipeline once Vite wiring is added.
- Directory structure for adapters (`src/adapters`), pipeline primitives (`src/pipeline`), and UI bindings (`src/ui`) is in place so teams can work in parallel.

## Immediate next steps

1. **Tooling:** Add a lightweight Vite config (or similar) under `packages/video-effects/demo` to bundle `demo/main.ts` during development. Decide if the package should build via `tsc` or a bundler (e.g., `tsup`) and update scripts accordingly.
2. **MediaPipe adapter:** Stand up `src/adapters/mediapipe.ts` that loads the portrait segmentation model, normalises masks, and exposes the shared `ISegmenter` interface.
3. **Pipeline loop:** Implement `src/pipeline/stream.ts` using Insertable Streams (`MediaStreamTrackProcessor`/`Generator`) with a basic compositor that blends the source frame + segmentation mask.
4. **Mock/UI integration:** Replace the current pass-through mock once the pipeline hardens, but keep a trivial mock export for unit/UI tests.
5. **Testing:** Add unit tests for smoothing utilities and mask post-processing; extend the demo harness to surface frame timing telemetry.

## Longer-term considerations

- Introduce ONNX Runtime Web support for higher-fidelity segmentation (MODNet/RVM) gated by the `engine` option.
- Add chroma-key shader path that bypasses ML when users opt for a pure color key.
- Surface feature flags inside the main app so the Presenter page can choose between the raw camera track and the processed track at runtime.
- Track model licensing and delivery requirements (`assets/models/*`).

This file should be updated as milestones land so the UI team knows which capabilities are safe to integrate.

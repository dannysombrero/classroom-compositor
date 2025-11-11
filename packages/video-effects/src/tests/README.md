# Video Effects Test Plan

This folder will hold pipeline-level tests once the MediaPipe adapter and compositor land. Target coverage includes:

- **Mask smoothing utilities:** deterministic EMA + morphology with synthetic masks.
- **Pipeline frame loop:** ensure Insertable Streams pump respects inference throttling + cleanup.
- **Compositor fallbacks:** regression tests for CPU path once shaders are implemented.

Tooling: Vitest (`npm run test -- --runInBand`) once the suite is wired. Tests should run headless with mocked WebCodecs/WebGL APIs.

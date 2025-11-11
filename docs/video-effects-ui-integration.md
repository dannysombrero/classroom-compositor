# Presenter UI Integration Plan — Background Effects

This note captures how the presenter experience will adopt the new background-effects engine without disrupting existing capture flows.

## Entry point

- `src/pages/PresenterPage.tsx` owns the camera stream today via `startCameraCapture`.
- The future `createBgEffect` hook should wrap the camera track when the feature flag is enabled.
- Integration goal: keep the track boundary identical for downstream consumers (`sendStreamToViewer`, overlays).

## Proposed wiring

1. **Feature flag:** introduce `video.effects.enabled` (boolean) in app settings/store.
2. **Hook:** add a helper (`useBackgroundEffectTrack`) that:
   - Accepts the raw `MediaStreamTrack`.
   - Reads user preferences (mode, engine, quality, background asset).
   - Lazily creates the engine (`createBgEffect`) and returns the processed track.
   - Handles cleanup on unmount / flag change.
3. **PresenterPage changes:**
   - When adding a camera layer, request the processed track if the flag is on, otherwise reuse the raw track.
   - Expose UI controls (mode dropdown, quality slider, background asset picker) in `CameraOverlayControls`.
   - Update preview stream (`startStreaming`) to use the processed track transparently.

## API surface alignment

- Engine options map 1:1 with planned UI controls:
  | UI Control | Engine option |
  |------------|---------------|
  | Mode select (`Off/Blur/Replace/Chroma`) | `mode` |
  | Engine select (`MediaPipe/ONNX`) | `engine` |
  | Quality slider | `quality` + `inferenceFps` |
  | Background asset chooser | `background` |

- UI should call `engine.update()` on control changes; no restart unless engine choice changes.

## Testing checklist (UI level)

- Camera capture works identically when feature flag is off.
- When enabled, switching modes updates the preview without track flicker.
- Cleanup (`stop()`) triggers when:
  - Camera layer removed.
  - PresenterPage unmounts.
  - Feature flag toggled off.
- Replace/chroma modes respect selected assets/backgrounds.

## Next steps

1. Implement `useBackgroundEffectTrack` hook with current mock engine (pass-through) to unblock UI integration.
2. Add temporary UI controls gated behind the feature flag to exercise the mock.
3. Once MediaPipe adapter lands, the UI can switch to real processing with minimal changes.

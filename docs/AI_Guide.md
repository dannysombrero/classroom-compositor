# AI Guide — How to Help on This Repo

## Context
We are building a local-first, browser-based classroom compositor. MVP focuses on speed, simple overlays, and a Presenter/Viewer split with single-screen Presentation Mode.

## Constraints & Preferences
- TypeScript strict; functional, modular React.
- State in Zustand slices; serializable; side effects isolated.
- Rendering via Canvas 2D with a thin renderer layer (possible future WebGL2 swap).
- Persistence via Dexie (IndexedDB). Assets: reference by default, embed on clipboard paste.
- No server in MVP; Viewer is a second window on the same device. WebRTC later.

## Definitions
- *Scene:* canvas size + ordered layers.
- *Layer types:* screen, camera, image, text, shape, group.
- *Groups:* group transforms; preserve child visibilities on toggle.

## Performance Budget
- 1080p @ 30fps target on typical Windows 11 school machines.
- Use throttling/dirty redraws; avoid unnecessary React re-renders.

## What to generate
- Small, testable components with clear props.
- Zustand slices with actions (no inline mutations outside store).
- TSDoc for exported functions and types.
- Minimal dependencies.

## What NOT to do (MVP)
- No chroma key, WebRTC, recording, timers, or cloud sync.
- No global CSS frameworks; keep it minimal.

## Open Questions (leave TODOs)
- Grid spacing customization
- Future Undo/Redo history middleware
- Viewer reconnection UX when capture stops

## Example Prompt to Follow
“Create `PresenterCanvas.tsx` that draws layers from the Zustand store to a `<canvas>`. Include hit-testing, selection (click/shift/marquee), transform handles, and snap-to-grid. Provide a `useCanvasRenderer` hook. Do not add WebGL or external libs.”
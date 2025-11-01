# Architecture

## Stack
React + TypeScript + Vite; Zustand for state; Dexie (IndexedDB) for persistence; Canvas 2D renderer; tinykeys for hotkeys.

## Windows/Modes
- Presenter window: edits + renders to a single `<canvas>`.
- Viewer window: opened via `window.open('/viewer')`; receives `canvas.captureStream(30)` via `postMessage` and plays `<video>` full-bleed.
- Single-screen: Presentation Mode hides chrome; Confidence Preview is a floating DOM thumbnail; control strip is DOM-only.

## Rendering
- Scene graph → draw pipeline:
  - Order: groups → children → camera (circle clip) → images → shapes → text.
  - Dirty-rect/throttled redraw; offscreen canvas ready for later.

## Persistence
- Scenes/Assets in IndexedDB (Dexie).
- AssetManager: `reference` (uri) or `embedded` (blobId, sha256). Clipboard pastes embed by default. Actions: “Embed” and “Externalize.”

## Data Model (summary)
Scene → Layers[] (Screen | Camera | Image | Text | Shape | Group)
- Each Layer: id, name, visible, locked, z, transform {pos, scale, rot, opacity}
- Group: children[] (layer ids), preserves per-child visibility when group toggles
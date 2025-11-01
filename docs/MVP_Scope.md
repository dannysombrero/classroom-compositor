# MVP Scope — Classroom Compositor

## Job-to-be-done
Layer webcam + simple overlays over live screen capture, with fast visibility toggles and groups. Present on a second window or single-screen Presentation Mode.

## Day-1 MUSTS
- Sources: screen/window capture, webcam (circle mask, soft border).
- Overlays: text pill (font/size/bg/opacity/radius/padding/shadow, autosize), image, rect shape.
- Layout: snap-to-grid, z-order, groups (group transform, preserve per-item visibility), overlay panel with visibility toggles.
- Hotkeys: select/multiselect/marquee, copy/paste/duplicate, nudge (1px/10px), group/ungroup, toggle visibility.
- Modes: Presenter + Viewer (separate window), Presentation Mode (`F`/`Esc`), Confidence Preview (`P`), minimal control strip (auto-hide).
- Persistence: Save / Save As scenes (Dexie/IndexedDB). Referenced images by default; pasted images embedded.

## Day-2 (Not in MVP)
Timer, pointer highlight/click ripple, background blur, text presets, “classes” (scene collections), export/import bundles, LAN join-code (WebRTC), recording (auto-download).

## Non-goals (MVP)
No chroma key, no cloud sync, no student auth, no server rendering.
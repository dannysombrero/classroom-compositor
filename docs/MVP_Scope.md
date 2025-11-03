# MVP Scope — Classroom Compositor

## Job-to-be-done
Layer webcam + simple overlays over live screen capture, with fast visibility toggles and groups. Present on a second window or single-screen Presentation Mode.

## Day-1 MUSTS
- [x] Sources: screen/window capture, webcam (circle mask, soft border). *(camera refresh auto-reactivate still pending)*  
- [x] Overlays: text pill (font/size/bg/opacity/radius/padding/shadow, autosize), image, rect shape.  
- [ ] Layout: snap-to-grid, **groups (create/collapse still TODO)**, overlay panel refinements.  
- [ ] Hotkeys: select/multiselect/marquee, group/ungroup — **multi-select & grouping pending**.  
- [x] Modes: Presenter + Viewer (separate window), Presentation Mode (`F`/`Esc`), Confidence Preview (`P`), minimal control strip (auto-hide).  
- [x] Persistence: Save / Save As scenes (Dexie/IndexedDB). *(Asset manager upgrade scheduled)*.

## Day-2 (Not in MVP)
Timer, pointer highlight/click ripple, background blur, text presets, “classes” (scene collections), export/import bundles, LAN join-code (WebRTC), recording (auto-download).

## Non-goals (MVP)
No chroma key, no cloud sync, no student auth, no server rendering.

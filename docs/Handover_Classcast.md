# 🧭 Project Handover: ClassCast (classcast.app)
**Prepared for:** Codex Development Team & Product Management  
**Author:** Daniel — Lead Concept Developer  
**Date:** 2025-11-02  

---

## 🚀 Overview
**ClassCast** is a lightweight, browser-based *classroom compositing and engagement platform* designed to give teachers the expressive power of a livestream (like OBS) without the technical bloat.

It enables educators to:
- Combine **screen/window capture**, **webcam feed**, and **overlays** into clear visual scenes.  
- Mirror the composed canvas to a “viewer” window or URL for projection.  
- Toggle overlays and scenes live via an intuitive panel.  
- Eventually record, replay, and analyze lessons as engaging “class streams.”

The guiding principle: **make classroom presentations feel alive** while keeping the tool friction-free for district-managed environments.

---

## 🧱 Current MVP Status (Sprint 1)

### ✅ Functional Today
- Presenter ↔ Viewer loop with shared `canvas.captureStream()` and presentation/preview overlays.  
- Layers: text, image, rectangle, camera (mask + pan/zoom), screen capture stubs.  
- Transform tooling with snap, scale clamps, lock/visibility toggles, undo/redo history.  
- Properties panel for fonts, colors, opacity, image/shape sizing, camera controls.  
- Dexie persistence with auto-save, scene autoload on refresh, loading overlay.  
- Hotkeys: nudge (±1/±10), copy/paste/duplicate, visibility, lock, delete/backspace, undo/redo, presentation/preview toggles.  
- Documentation + roadmap + handover refreshed (this doc).

### 🧩 Outstanding for MVP Completion
- **Canvas selection ergonomics:** marquee multi-select, shift-click, direct hit-testing.  
- **Grouping:** create/rename groups, collapse in the panel, per-group visibility.  
- **Overlay panel polish:** redesigned Properties layout, consistent add-menu dropdown positioning.  
- **Clipboard image paste:** accept `image/*` data from OS clipboard.  
- **Camera lifecycle:** auto-reactivate stream after refresh without manual toggle.  
- **Screen capture UX:** friendly permission prompts, visible status indicator.  
- **Asset manager:** reference vs embedded blobs (current embeds are inline).

---

## 🎯 Next Implementation Target
Sprint 4 (Layout polish & interaction QoL):
1. Rebuild Objects & Layers panel layout (group support, marquee/shift select).  
2. Clipboard paste for images + asset persistence.  
3. Camera auto-reactivate on scene restore.  
4. Add unit tests covering undo/redo stack integrity.

---

## 🗺️ Roadmap by Phase

### **Sprint 1–2 · Core Composition (complete)**
- Canvas renderer, layers, and properties UI  
- Presenter/Viewer windows + Presentation/Preview surfaces  
- Dexie persistence, undo/redo history and hotkeys  
- Camera mask tooling, image/shape scaling clamps

### **Sprint 3 · Interaction Polish (in progress)**
- Multi-select (drag box + shift click)  
- Groups & collapse/expand in panel  
- Clipboard image paste + asset metadata  
- Panel layout redesign, dropdown positioning fixes  
- Auto-reactivate camera sources on scene load

---

### **Sprint 4 · Engagement Layer**
Goal: simulate stream-like energy without external accounts.
- Fake / AI “classmates” (Tier 1 = scripted timed chat events)  
- Comment ticker + emoji reactions (BroadcastChannel prototype)  
- Theme presets (“Classroom Vibes”)  
- Local moderation filter (blocklist + regex + rate-limit)  
- Engagement event logger foundation

---

### **Sprint 5 · Replay & Analytics Foundation**
Goal: allow teachers to review lessons & engagement trends.
- Local engagement logging (hearts, overlay toggles, comments)  
- **After-Class Replay v1:**  
  - Record composited canvas via MediaRecorder  
  - 720p/1080p @ 15 fps recommended  
  - Timeslice + File System Access API write  
  - JSON event log for chat/reactions  
- Basic Analytics dashboard (“hearts per minute”, “top interactions”)

---

### **Sprint 6 · Accounts & Cloud Sync**
- Optional teacher login (Supabase/Firebase)  
- Scene & asset cloud sync  
- Participation leaderboard (local → cloud extension)  
- Optional saved-stream library foundation (future paid feature)

---

### **Sprint 7+ · Differentiators / AI Layer**
- AI Classmates (Tier 2–3): context-aware reactions & questions  
- AI Engagement Summary: tone & confusion analysis  
- Replay 2.0 (video + chat synchronization)  
- Advanced moderation (TF.js / external API opt-in)

---

## ⚙️ Technical Design

### Stack
| Layer | Tech |
|-------|------|
| **Frontend** | React + TypeScript + Vite |
| **Rendering** | HTML Canvas 2D (OffscreenCanvas later for perf) |
| **Persistence** | Dexie (IndexedDB) + LocalStorage shim |
| **Routing** | Simple pathname check (no Router yet) |
| **Testing** | Vitest + React Testing Library |

---

### Service Interfaces (defined / stubbed)

#### `RecordingService`
```ts
export type RecQuality = 'low_720p15' | 'std_1080p15' | 'high_1080p30';
export interface RecordingOpts {
  quality: RecQuality;
  includeMic: boolean;
  includeSystemAudio: boolean;
}
export interface RecordingService {
  isSupported(): boolean;
  start(opts: RecordingOpts): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): Promise<{ videoPath?: string; bytes?: number }>;
}

Currently a no-op stub; ensures future recording & audio integration require no UI refactor.

ModerationService
export interface Moderation {
  filter(input: string): { allowed: boolean; redacted?: string; reason?: string };
}

Implements local blocklist + regex MVP; TF.js toxicity or cloud API can be swapped in later.

Replay / Storage Metrics
Mode
Resolution
FPS
Est. Bitrate
45 min Approx.
Notes
Low
720p
15
1–2.5 Mbps
0.35–0.85 GB
Balanced
Standard
1080p
15
2–5 Mbps
0.7–1.7 GB
Recommended
High
1080p
30
3–8 Mbps
1.2–2.8 GB
Heavy but smooth

Chat/event log ≈ < 1 MB per class.
Use timesliced recording + File System Access API to avoid memory ballooning.

⸻

Moderation Model (Local-First)
	1.	Strict / Standard / Off presets.
	2.	Word & phrase blocklist + PII regex.
	3.	TF.js toxicity model (optional).
	4.	Future cloud moderation API (opt-in).

⸻

🧠 Engagement & Differentiation Summary
Feature
Priority
Description
Fake AI Classmates (Tier 1)
High
Scripted chat for liveliness
“Memify Mode”
Low
Event-triggered memes
After-Class Replay
High
Replay canvas + chat timeline
Participation Leaderboard
Medium
Gamified reactions
Theme Presets
Medium
Quick visual styles
Analytics Dashboard
High
Engagement insights
AI ClassBots (Tier 2)
Future
Personality-driven AI students
AI Summary
Future
Post-class report of key moments


🔒 Privacy & Compliance
	•	No student audio/video captured by default.
	•	Replay records only teacher’s composited output + simulated chat.
	•	Local moderation keeps all chat G-rated.
	•	Entirely local first; cloud sync is opt-in for district safety.

⸻

🔮 Long-Term Vision

ClassCast evolves into an interactive classroom broadcast platform — blending presentation clarity with the immediacy of a livestream.
AI classmates, reactions, and analytics transform static instruction into an engaging, game-like experience while preserving teacher simplicity.

⸻

✅ Next Immediate Steps (for Codex & PM)
	1.	Ship marquee selection + shift-click and group collapse.  
	2.	Implement clipboard image paste with Dexie asset entries.  
	3.	Finalize panel layout redesign (properties attached, dropdown offset).  
	4.	Handle camera auto-reactivation on refresh.  
	5.	Start multi-layer undo snapshot tests.  
	6.	Prep engagement-layer skeleton (Level 1 scripted bots) after layout sprint.

⸻

Handoff Summary

All architectural groundwork and MVP design decisions are established.
Next milestones: source integration → overlay tooling → engagement foundation.
Recording & replay are planned but deferred; stubs exist for easy future integration.
Maintain focus on teacher-friendly simplicity while expanding the creative, “stream-like” energy that defines ClassCast.

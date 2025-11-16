# ClassCaster v1 – Start Session & Stream Controls End-to-End Spec

## 🎯 Version Goal
Create a smooth, safe, teacher-friendly workflow for 1-monitor and 2-monitor classrooms by introducing:

- A **Start Session** flow (replacing Go Live)
- A **Stream Controls Popup** window (chat, join code, basic controls)
- A **Pause/Resume system** to prevent feedback loops while editing scenes
- A clear separation between:
  - Console window  
  - Viewer window  
  - Stream Controls window  

This spec describes the entire v1 flow, start to finish.

---

# 1. START SESSION (replaces “Go Live”)

## 1.1. Behavior
When the teacher clicks **Start Session** in the main console:

- Create a **new session ID**
- Generate:
  - Join Code (e.g., `ABC-123`)
  - Join Link (e.g., `https://classcaster.app/join/ABC-123`)
- Open the **Stream Controls window** via `window.open()`, passing session ID

Route example:

```
/controls/:sessionId
```

- Show a **Session Setup Overlay** in the main console window.

---

## 1.2. Session Setup Overlay (console UI)
After Start Session, the main console window becomes a guided screen:

```
📡 Your ClassCaster Session is Ready!

✔ Stream Controls window is open.
✔ Join Code is shown in the controls.

👇 Next steps:
1. Move this console window out of the way or minimize it.
2. Keep the Stream Controls window visible during your lesson.
3. Use “Start Streaming” from the Controls window when ready.
```

**Acceptance Criteria:**
- Overlay appears automatically after `Start Session`.
- Overlay must block the editor until the user dismisses it (or minimize).
- Works in single-tab or multi-tab scenarios.

---

# 2. STREAM CONTROLS POPUP (separate window)

A persistent, small, draggable window that never contains live video.

Route:

```
/controls/:sessionId
```

## 2.1. Layout

### A) Top Status Bar
```
[LIVE]  or  [PAUSED]  or  [NOT STREAMING]

[Start Streaming] / [Pause] / [Resume] / [End Session]
```

### B) Join Code Section
```
JOIN CODE: ABC-123

[ Copy Code ]  [ Copy Join Link ]
```

### C) Chat Panel
- Scrollable list of messages
- No input box yet
- Button: `[Hide chat]` → collapses to `Chat (3)`
- `[Show chat]` expands full chat

### D) Window Behavior
- Draggable
- Minimal browser chrome
- No video preview
- Optional: remember collapsed state

---

## 2.2. Controls Popup Actions

### Start Streaming
- Begin screen capture (`getDisplayMedia`)
- Start WebRTC broadcast
- Status → `LIVE`

### Pause
- Replace outgoing video with “Stream Paused” placeholder
- Allow safe editing

### Resume
- Restore outgoing screen capture

### End Session
- Terminate stream
- Close peer connections
- Status → `ENDED`

---

## 2.3. Acceptance Criteria
- Popup opens reliably with session ID
- Start/Pause/Resume/End work and update UI state
- Join Code visible at all times
- Chat updates live
- Collapsing chat works
- Popup functions even if main console is minimized

---

# 3. VIEWER WINDOW

Route:
```
/viewer/:sessionId
```

### Layout
- **Left:** streamed video
- **Right:** chat sidebar
- Full screen mode for projectors

### Projector Mode Route
```
/viewer/:sessionId?mode=projector
```

---

## Viewer Acceptance Criteria
- Connects to session
- Shows streamed video or paused placeholder
- Displays same chat feed

---

# 4. RECOMMENDED TEACHER FLOWS

## 4.1. Two-Monitor Classroom

1. Open ClassCaster on laptop.
2. Build scene.
3. Click **Start Session**.
4. Drag Viewer window to big monitor → full screen.
5. Keep controls popup on laptop.
6. Click **Start Streaming**.
7. Minimize console if desired.
8. Teach normally.

Scene editing workflow:
- **Pause** → edit → **Resume**.

---

## 4.2. One-Monitor Classroom

1. Start Session → popup opens.
2. Click **Start Streaming**.
3. Minimize console.
4. Teach normally with popup visible.

Scene editing requires:
- **Pause** → restore console → edit → minimize → **Resume**.

---

# 5. TECHNICAL SPEC — STREAM STATES

State machine:

```
NOT_STREAMING
    ↓ Start Streaming
LIVE
    ↓ Pause
PAUSED
    ↓ Resume
LIVE
    ↓ End Session
ENDED
```

### Transitions

#### NOT_STREAMING → LIVE
- Acquire screen capture
- Begin broadcast

#### LIVE → PAUSED
- Swap outgoing track with placeholder
- Keep WebRTC connection alive

#### PAUSED → LIVE
- Swap placeholder with live capture

#### LIVE → ENDED
- Close tracks
- End session

---

# 6. CHAT SYSTEM (v1)

### Requirements
- No input yet (teacher/student chat later)
- Display-only
- Messages from:
  - Test/debug
  - Future bots
  - Future students

### Model
```ts
type ChatMessage = {
  id: string;
  authorName: string;
  authorType: 'bot' | 'system' | 'student';
  text: string;
  timestamp: number;
}
```

### Acceptance Criteria
- Chat visible in Viewer + Popup
- Collapsing works
- Auto-scroll unless user scrolls up

---

# 7. MAIN CONSOLE CHANGES

### After Start Session:
- Console shows setup overlay
- Join Code moves to popup only
- Scene editor usable only when stream is paused

### Acceptance Criteria:
- Overlay appears automatically
- Minimized console does not break stream
- Editing while paused works safely

---

# 8. OUT-OF-SCOPE FOR v1
- Student chat input  
- Viewer count  
- Scene navigation in popup  
- Transparent overlays  
- Auto-minimize  
- Always-on-top  
- Multi-teacher sessions  
- Bot logic  
- Advanced scene saving  

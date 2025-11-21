# 📨 Chat System — Figma / AI Designer Guidelines

This document defines all UI requirements for designing the **ClassCaster Chat System**.

The chat UI must work in **three different render modes**, and must be built using modular controlled components that accept props.

---

# 1. Chat Components Overview

Design **four independent UI components**, each exportable:

1. **ChatContainer**
2. **ChatMessageList**
3. **ChatMessageInput**
4. **ChatOverlay (Canvas Layer)**

These components must be usable in any layout the app requires.

---

# 2. ChatContainer Requirements

A flexible wrapper that adjusts behavior based on placement.

### Props
```ts
interface ChatContainerProps {
  messages: ChatMessage[];
  onSendMessage?: (text: string) => void;
  onClose?: () => void;
  title?: string;
  variant: "console" | "viewer" | "overlay";
}
```

---

## A. variant = "console"
**Context:** Appears inside the Live Console (default for 1–2 monitor setups).  
**Style:** Panel UI  
**Width:** 280–320px  

Includes:
- Header
- Scrollable message list
- Input box (hidden until v1.1 student chat)

---

## B. variant = "viewer"
**Context:** Viewer Window (right-hand side).  
**Style:** Panel UI with mild transparency  
**Background:** `bg-neutral-800/80`  
**Height:** Full panel height  

---

## C. variant = "overlay"
**Context:** Rendered as a draggable layer on the canvas (default for 3-monitor setups).  
**Style:** Overlay panel  

Includes:
- Transparent background: `bg-neutral-900/30`
- Rounded-lg border
- Scrollable message list
- **NO input box**
- Optional minimal header

---

# 3. ChatMessageList Requirements

### Props
```ts
interface ChatMessageListProps {
  messages: ChatMessage[];
}
```

### Behavior
- Auto-scroll to bottom on new message  
- Smooth scroll animations  
- Group messages from the same sender  
- Show timestamps (optional small text)

### Sender Types
| Sender   | Style |
|----------|--------|
| Teacher  | Blue accent, white text |
| Bot      | Neutral bubble with bot icon |
| Student  | Neutral gray bubble |

---

# 4. ChatMessageInput Requirements

Even if disabled early on, UI must exist.

### Props
```ts
interface ChatMessageInputProps {
  onSend: (text: string) => void;
}
```

### UI Guidelines
- Rounded input: `rounded-full bg-neutral-700 px-3 py-2 text-white`
- Send button: ghost variant w/ lucide `send` icon

---

# 5. ChatOverlay Requirements

Used when chat is placed as an overlay on the canvas.

### Props
```ts
interface ChatOverlayProps {
  messages: ChatMessage[];
  onMove?: (x: number, y: number) => void;
  width?: number;
  height?: number;
}
```

### Design
- Transparent background (`bg-neutral-900/30`)
- Border: `border border-neutral-700/40`
- Scrollable area
- NO input field  
- Optional “Chat” header

---

# 6. Chat Placement Modal (Required)

When user clicks the Chat icon:

### Show a modal offering:
- **Console Chat** (recommended for 1–2 monitors)
- **Overlay Chat** (recommended for 3 monitors)
- **Off**

Design should include:
- Radio button list  
- Current option highlighted  
- Small “Recommended” subtext per mode  
- Confirm/Cancel buttons  

---

# 7. Visual Style Guidelines

### Colors
- Teacher: `bg-blue-600/20`
- Bot: `bg-blue-600/10`
- Student: `bg-neutral-700`
- Panels: `bg-neutral-800`
- Overlay: `bg-neutral-900/30`

### Sizing
- Overlay: ~300×450  
- Viewer chat: ~320px  
- Console chat: 280px fixed  

### Typography
- Base 14px  
- Timestamp 12px  
- Sender name semibold  

---

# 8. Interaction Behaviors

- Hover: subtle highlight  
- Input focus: `ring-1 ring-blue-600`  
- Overlay selected: `ring-1 ring-blue-500`  
- Auto-scroll to bottom on update  

---

# 9. Data Structures

### ChatMessage
```ts
interface ChatMessage {
  id: string;
  sender: "teacher" | "bot" | "student";
  senderName: string;
  text: string;
  timestamp: number;
}
```

Messages must be rendered dynamically with `.map()`.

---

# 10. Prohibited Patterns

❌ No hardcoded chat messages  
❌ No internal state for message storage  
❌ No absolute positioning (except overlay)  
❌ No designing canvas geometry  
❌ No inline styles—must use Tailwind  

---

# 11. Code Export Requirements

- Export components individually  
- Use Tailwind classes only  
- Use TypeScript  
- Components must be controlled  
- Do NOT design the HTML canvas  

---

# 12. Deliverables the Designer Must Produce

### Required
- ChatContainer (3 visual variants)
- ChatMessageList
- ChatMessageItem
- ChatMessageInput
- ChatOverlay
- Chat Placement Modal
- Chat toolbar icon + states (active, disabled, hover)

### Not Required
- AI logic  
- Networking  
- WebRTC  
- Canvas rendering  

---

# ✔️ End of Document

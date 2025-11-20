# 📨 Chat System — UI Component Guidelines

Design a **reusable chat widget** that works in multiple contexts with minimal styling constraints.

---
AI Chat Bot Feature Guidelines can be found below: 

## Core Requirement

Build **ONE flexible component** that adapts to different contexts via props, not separate components for each use case.

---

## Component: ChatWidget

### Required Props
```ts
interface ChatWidgetProps {
  messages: ChatMessage[];
  width?: number;           // Default: 380
  height?: number;          // Default: 500
  embedded?: boolean;       // If true: no border/background (for canvas)
  showInput?: boolean;      // Default: false (bot testing phase)
}
```

### Usage Contexts

**1. Canvas Overlay** (3-monitor setup)
- `embedded={true}` - transparent, no chrome
- Rendered at layer position/scale/rotation
- Display-only (no input)

**2. Console Panel** (1-2 monitor setup)
- `embedded={false}` - standard panel UI
- Fixed width ~280-320px
- Display-only for now

**3. Viewer Window**
- `embedded={false}` - panel with mild transparency
- Right-side panel, full height

---

## Message Data Structure

**IMPORTANT:** Match this exactly - already implemented in code.

```ts
interface ChatMessage {
  id: string;
  from: "teacher" | "bot" | "student";  // NOT "sender"
  senderId?: string;
  senderName?: string;
  text: string;
  timestamp: number;  // Unix timestamp in milliseconds
  botId?: string;     // If from === "bot"
}
```

---

## Essential Features

✅ **Auto-scroll** to latest message
✅ **Message grouping** from same sender (optional but nice)
✅ **Timestamps** (subtle, small)
✅ **Visual distinction** between teacher/bot/student
✅ **Responsive to width/height props**

---

## Input Component (Future)

Even though disabled now, create the UI:

```ts
interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}
```

Simple text input + send button. Will be enabled in v1.1.

---

## Technical Requirements

**MUST:**
- Use TypeScript
- Use controlled components (no internal message state)
- Render messages with `.map()` from props
- Support `width` and `height` props
- Support `embedded` mode (no background/border)

**MUST NOT:**
- Hardcode messages
- Use absolute positioning (except for embedded overlay)
- Manage message state internally
- Design canvas layer geometry (that's handled elsewhere)

---

## Code Export

Export as:
- `ChatWidget.tsx` - Main component
- `ChatMessage.tsx` - Individual message (if separated)
- `ChatInput.tsx` - Input component (if separated)

Use whatever styling approach you prefer (Tailwind, CSS modules, styled-components, etc.)

---

## What NOT to Design

❌ Canvas rendering logic
❌ Firestore/networking
❌ Bot system
❌ Layer transform controls
❌ Monitor detection modal
❌ Any complex placement/settings UI (not needed yet)

---

## Deliverables

### Required Components:
1. **ChatWidget** - Main component with variants
2. **ChatMessage** - Individual message display (if separate)
3. **ChatInput** - Input field + send button (if separate)

### Visual States:
- Normal state
- With/without input
- Embedded vs panel mode
- Empty state (no messages)

### NOT Required:
- Complex modals
- Settings panels
- Multiple toolbar states
- Placement chooser UI

---

## Integration Notes

This replaces the current temporary chat components in:
- `src/ai/components/chat/ChatWidget.tsx`
- `src/ai/components/chat/ChatMessage.tsx`
- `src/ai/components/chat/ChatInput.tsx`

The component will be used via:
```tsx
<ChatWidget
  messages={messages}
  width={380}
  height={500}
  embedded={true}
/>
```

---

## Example Message Flow

```tsx
const messages: ChatMessage[] = [
  {
    id: "msg1",
    from: "bot",
    senderName: "Engagement Bot",
    text: "Welcome everyone! Ready to learn?",
    timestamp: 1700000000000,
    botId: "engagement-bot"
  },
  {
    id: "msg2",
    from: "teacher",
    senderName: "Teacher",
    text: "Let's get started!",
    timestamp: 1700000001000
  }
];
```

---

## Questions?

If unclear about any technical integration points, ask before designing.

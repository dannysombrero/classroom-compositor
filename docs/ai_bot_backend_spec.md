# ClassCaster AI Bot System — Backend Developer Spec

## 1. Purpose

This document defines the backend responsibilities, APIs, data models, and event flows for the **ClassCaster AI Bot System**.  
It is intended for backend developers implementing the bot tiers, AI endpoints, and session orchestration.

The system is **tiered**. Each tier unlocks additional capabilities. Backend code MUST enforce tier boundaries so that:
- Lower tiers cannot accidentally call higher-tier AI behavior.
- Features are rolled out gradually across app versions.

---

## 2. Versioning & Tiers

AI Bot features are grouped into tiers and mapped to product versions:

| Version | Tiers Included |
|---------|----------------|
| **v1**  | Tier 0, Tier 0.5 |
| **v1.1 / v1.2** | Tier 1 |
| **v2**  | Tier 2, Tier 3 |
| **v3**  | Tier 4 |
| **v4+** | Tier 5 |

Back-end must expose a way to check which tiers are enabled for a given deployment or session, e.g.:

```ts
type EnabledTiers = {
  tier0: boolean;
  tier0_5: boolean;
  tier1: boolean;
  tier2: boolean;
  tier3: boolean;
  tier4: boolean;
  tier5: boolean;
};
```

These flags can be drawn from environment config, feature flags, or per-account settings.

---

## 3. Core Concepts

### 3.1 Bot Student

Bots behave like “virtual students” in the chat. They are not teachers and do not override the teacher.

Backend representation:

```ts
type Bot = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  tier: number; // 0, 0.5, 1, 2, 3, 4, 5
  schedule?: BotSchedule;      // Tier 0/0.5
  remainingQuestions?: string[];
  lastMessageAt?: number;      // timestamp
};
```

### 3.2 Session Context

Backend maintains state for each streaming session:

```ts
type SessionContext = {
  sessionId: string;
  teacherDescription?: string;   // From AI Lesson Helper
  aiKeywords?: string[];         // Tier 0.5
  aiQuestions?: string[];        // Tier 0.5 (teacher-approved)
  botConfig?: BotConfig;
  liveTranscriptBuffer?: TranscriptChunk[]; // Tier 2+
  recentChatBuffer?: ChatMessage[];         // Tier 2+
  tierEnabled: EnabledTiers;
};
```

Supporting types:

```ts
type TranscriptChunk = {
  text: string;
  timestamp: number;
};

type ChatMessage = {
  id: string;
  from: "teacher" | "student" | "bot";
  senderId?: string;
  sessionId: string;
  text: string;
  timestamp: number;
};

type BotConfig = {
  activeBots: Bot[];
  scheduleMode: "timed" | "keyword" | "mixed";
};
```

---

## 4. Tier Overview (Backend Responsibilities)

### Tier 0 — Bot Simulation (No AI)

- Provide a system for bots to send **pre-scripted messages**.
- Optionally trigger messages at random intervals or basic keyword matches.
- No LLM calls or AI endpoints.

### Tier 0.5 — Teacher Helper AI (Pre-Session Only)

- LLM endpoints that:
  - Take a **lesson description**.
  - Generate **keywords** relevant to the lesson.
  - Generate **expected student questions**.

- Back-end stores final teacher-approved keyword / question lists in session context.

### Tier 1 — Keyword-Triggered Bots (Local Detection)

- Receive keyword trigger events (from frontend audio/OCR subsystems).
- Choose an appropriate question from the **pre-approved** bank.
- Inject that question into the chat as a bot message.

No live LLM calls in Tier 1.

### Tier 2 — Intelligent Bot Questions (Live LLM Questions)

- Accept **rolling transcript buffer** + **recent chat**.
- Occasionally call LLM to generate context-aware clarifying questions.

### Tier 3 — Teaching Assistant Mode (Bots Answering Questions)

- When students ask questions in chat, call LLM to generate short answers.
- Apply safety rules and moderation.
- Return safe answers as bot messages.

### Tier 4 — AI Assessment (Exit Tickets & Quizzes)

- After session ends, call LLM to generate exit tickets / mini quizzes based on:
  - Transcript summary
  - Detected key concepts
  - Possibly lesson description

### Tier 5 — Adaptive Teaching Assistant (Long-Term)

- Analyze larger-scale data for teacher feedback (not required for near-term MVP).
- No immediate implementation required; more of a future design target.

---

## 5. HTTP / API Endpoints

### 5.1 Tier 0.5 – Pre-Session AI Endpoints

#### POST `/ai/generate-keywords`

**Input**

```json
{
  "lessonDescription": "string"
}
```

**Output**

```json
{
  "keywords": ["string"]
}
```

Behavior:
- Use LLM to generate ~5–15 relevant keywords.
- Must be concise, single terms or short phrases.

---

#### POST `/ai/generate-questions`

**Input**

```json
{
  "lessonDescription": "string",
  "keywords": ["string"]
}
```

**Output**

```json
{
  "expectedQuestions": ["string"]
}
```

Behavior:
- LLM generates student-level questions that match the lesson description & keywords.
- Questions should be short, curious, and on-topic.
- Frontend handles editing/approval; backend can store final set via a separate endpoint.

---

#### POST `/session/:sessionId/ai-setup`

Used after teacher edits/approves keywords/questions.

**Input**

```json
{
  "aiKeywords": ["string"],
  "aiQuestions": ["string"]
}
```

**Output**

```json
{
  "ok": true
}
```

Backend should attach these to the `SessionContext` for Tier 0.5 and beyond.

---

### 5.2 Tier 0 & 0.5 – Bot Scheduling

#### POST `/bots/schedule`

**Input**

```json
{
  "sessionId": "string",
  "botId": "string",
  "questions": ["string"],
  "triggers": {
    "type": "timed",
    "intervalSeconds": 60,
    "maxQuestions": 5
  }
}
```

or

```json
{
  "sessionId": "string",
  "botId": "string",
  "questions": ["string"],
  "triggers": {
    "type": "keyword",
    "keywordMap": {
      "extrude": ["Can you show how to extrude again?"],
      "group": ["Can you show how to group shapes one more time?"]
    }
  }
}
```

**Output**

```json
{ "ok": true }
```

Backend:
- Stores schedule and links it to bot and session.
- Runtime bot engine decides when to send messages.

---

### 5.3 Tier 1 – Keyword Trigger Endpoint

Front-end sends keyword detection events (from Web Speech API, OCR, etc.).

#### POST `/bots/trigger`

**Input**

```json
{
  "sessionId": "string",
  "keyword": "string"
}
```

**Output**

```json
{
  "usedQuestion": "string | null"
}
```

Backend:
- Finds an appropriate question from `aiQuestions` or keyword map.
- Injects into chat as a bot message (if found).
- Returns which question was used, or `null` if none.

---

### 5.4 Tier 2 – Live Context Question Endpoint

#### POST `/ai/contextual-question`

**Input**

```json
{
  "sessionId": "string",
  "transcriptWindow": "string",
  "recentChat": [
    { "from": "student|teacher|bot", "text": "string" }
  ],
  "keywords": ["string"]
}
```

**Output**

```json
{
  "contextualQuestion": "string | null"
}
```

Backend behavior:
- Use LLM to propose a student-level clarifying question.
- If learning is clear and no obvious confusion → may return `null`.
- Must rate limit (e.g., no more than 1 call per 2–3 minutes per session).

---

### 5.5 Tier 3 – Answering Student Questions

#### POST `/ai/answer-question`

Triggered when a student question is flagged for bot answering.

**Input**

```json
{
  "sessionId": "string",
  "questionText": "string",
  "context": {
    "keywords": ["string"],
    "transcriptWindow": "string",
    "recentChat": [
      { "from": "student|teacher|bot", "text": "string" }
    ]
  }
}
```

**Output**

```json
{
  "answer": "string"
}
```

Backend behavior:
- LLM generates a short answer (1–3 sentences max).
- Answer must be safe and appropriate.
- Hook into a moderation step if necessary.
- Inject answer back into chat with sender = bot.

---

### 5.6 Tier 4 – Exit Ticket / Quiz Generation

#### POST `/ai/generate-exit-ticket`

**Input**

```json
{
  "sessionId": "string",
  "transcriptSummary": "string",
  "keyConcepts": ["string"]
}
```

**Output**

```json
{
  "multipleChoice": [
    {
      "question": "string",
      "choices": ["string"],
      "correctIndex": 0
    }
  ],
  "freeResponse": [
    {
      "question": "string"
    }
  ]
}
```

Backend:
- Uses LLM to generate short assessments from the summary + key concepts.
- Stores them in DB for use by students via Join Page or other UI.

---

## 6. Events & Real-Time Integration

Backend should support WebSocket or event-based hooks for:

### 6.1 onSessionStart
- Initialize `SessionContext`.
- Optionally load pre-configured bots and schedules.

### 6.2 onKeywordDetected (Tier 1+)
- Trigger `/bots/trigger` logic.

### 6.3 onTranscriptChunk (Tier 2+)
- Append incoming transcript lines.
- Maintain only the last N seconds/minutes in `liveTranscriptBuffer`.

### 6.4 onStudentQuestion (Tier 3+)
- Decide if question should be routed to `/ai/answer-question`.
- Respect teacher/bot settings (e.g., bots disabled, Q&A disabled).

### 6.5 onSessionEnd (Tier 4+)
- Generate transcript summary (if not already present).
- Optionally call `/ai/generate-exit-ticket`.

---

## 7. Transcript Handling (Tier 2+)

Front-end can POST transcript chunks periodically:

#### POST `/session/:sessionId/transcript/append`

**Input**

```json
{
  "textChunk": "string",
  "timestamp": number
}
```

Backend:
- Appends `TranscriptChunk` to `SessionContext.liveTranscriptBuffer`.
- Trims buffer to limit size (e.g., last 2–3 minutes).

---

## 8. Chat Buffer Handling (Tier 2+)

Backend should maintain a lightweight buffer:

```ts
SessionContext.recentChatBuffer = ChatMessage[];
```

Rules:
- Keep only last N messages (e.g., 20–50).
- Strip sensitive info if needed.
- Provide to LLM endpoints as part of `context` payloads.

---

## 9. OCR & Keyword Detection (Tier 1)

The backend does **not** handle raw screenshots.

Front-end is responsible for:
- Running OCR / surface-level detection.
- Emitting `keyword` events via `/bots/trigger`.

Backend only deals with opaque `'keyword'` strings.

---

## 10. Safety & Moderation

Backend must enforce:

- Tier gating: only allow calls to Tier 2/3/4 endpoints when explicitly enabled.
- Rate limiting for LLM calls per session and per teacher.
- Optional content moderation step for LLM outputs (especially Tier 3 answers).

Hard rules:
- Bots never correct or contradict the teacher.
- Bots never provide unsafe instructions or personal data.
- Bots always speak as “students,” not as system/AI.

---

## 11. Bot Behavior Engine (Orchestrator)

Suggested pseudo-logic for a bot orchestrator loop:

```ts
function handleBotTick(sessionId: string) {
  const ctx = getSessionContext(sessionId);
  const { tierEnabled, botConfig } = ctx;

  if (!botConfig) return;

  for (const bot of botConfig.activeBots) {
    if (tierEnabled.tier0 || tierEnabled.tier0_5) {
      // Scripted or scheduled questions
      maybeSendScheduledQuestion(bot, ctx);
    }

    // Tier 1 keyword triggers handled by /bots/trigger

    if (tierEnabled.tier2) {
      maybeRequestContextualQuestion(bot, ctx);
    }

    if (tierEnabled.tier3) {
      // Answering student questions handled by onStudentQuestion hooks
    }

    // Tier 4 handled at session end
  }
}
```

Backend implementation details can vary (cron-like, timer-based, or event-driven), but the logic should respect tiers and configuration.

---

## 12. Data Models Summary

### 12.1 Bot

```ts
type Bot = {
  id: string;
  displayName: string;
  avatarUrl?: string;
  tier: number;
  schedule?: BotSchedule;
  remainingQuestions?: string[];
  lastMessageAt?: number;
};
```

### 12.2 SessionContext

```ts
type SessionContext = {
  sessionId: string;
  teacherDescription?: string;
  aiKeywords?: string[];
  aiQuestions?: string[];
  botConfig?: BotConfig;
  liveTranscriptBuffer?: TranscriptChunk[];
  recentChatBuffer?: ChatMessage[];
  tierEnabled: EnabledTiers;
};
```

### 12.3 BotSchedule (Example)

```ts
type BotSchedule =
  | {
      type: "timed";
      intervalSeconds: number;
      maxQuestions: number;
    }
  | {
      type: "keyword";
      keywordMap: Record<string, string[]>;
    };
```

---

## 13. Implementation Priority Order (Backend)

1. **Tier 0**
   - Chat injection for bot messages
   - Basic scheduling logic

2. **Tier 0.5**
   - `/ai/generate-keywords`
   - `/ai/generate-questions`
   - `/session/:sessionId/ai-setup`

3. **Tier 1**
   - `/bots/trigger` + keyword handling logic

4. **Tier 2**
   - Transcript buffer storage
   - `/ai/contextual-question`

5. **Tier 3**
   - `/ai/answer-question`
   - Moderation hooks

6. **Tier 4**
   - `/ai/generate-exit-ticket`
   - Storage and retrieval for assessments

7. **Tier 5 (Future)**
   - Aggregated analytics and coaching logic

---

This spec should be sufficient for backend developers to:
- Implement the AI bot stack incrementally.
- Enforce tier boundaries.
- Integrate safely with the LLM layer and chat system.

# 🤖 AI Integration Plan — ClassCast

**Doc purpose:** Define where and how AI fits into ClassCast across MVP → v1.0, with privacy-first design, cost controls, and clear implementation tiers.

**Last updated:** 2025-11-02

---

## 0) Principles

- **Local-first.** Default to on-device extraction (keywords, OCR, transcript) and scripted bots. AI is additive, not required.
- **Privacy by design.** Never send student PII off device by default. Cloud features are opt-in and anonymized.
- **Predictable cost.** Hard rate limits, tiny prompts, and batching. “Smart Mode” is teacher-controlled.
- **Modular.** Level 1 (no-AI) → Level 2 (local AI) → Level 3 (cloud AI) using the same interfaces.

---

## 1) Feature Matrix (Local vs Firebase AI Logic vs Genkit)

| Feature | MVP Level | Primary Tech | Why |
|---|---|---|---|
| **AI Classmates (fake chat)** | **Level 1** | Scripted templates + heuristics | Zero cost, works offline, great vibe baseline |
| **AI Classmates (smart, context-aware)** | **Level 3** | **Firebase AI Logic** (Gemini) | Simple client calls, low latency; opt-in toggle “Smart Mode” |
| **Lesson Summary (post-class)** | **Level 3 (server)** | **Genkit + Cloud Functions** | Batch process logs safely, redact/anonymize first |
| **Moderation (chat)** | **Level 1 → 2** | Blocklist/regex → TF.js toxicity | Runs local; can add cloud as optional fallback |
| **Memify mode (fun comments/images)** | **Level 1 → 3** | Scripted → Firebase AI Logic | Start with templates; upgrade to generative later |
| **Analytics Insights (tone/confusion)** | **Level 3 (server)** | **Genkit + Cloud Functions** | Aggregate across sessions, privacy controlled |
| **Prompted teacher helper (“make a scene”)** | Level 3 (server) | **Genkit** | Requires orchestration & access control |

**Notes**
- “Level 2” (local LLM) is optional; quality vs perf varies widely. Prefer Level 1 + Level 3 path initially.

---

## 2) Data Flow & Privacy (PII)

### Local data we may extract
- **Transcript snippets** (on-device ASR or browser Speech API)  
- **Screen keywords** (OCR small regions or known overlay text)  
- **Event context** (overlay titles, active app, topic tag)

### Redaction rules (before any cloud call)
- Remove student names / emails / IDs (simple NER + class roster hash match).
- Drop raw audio & raw screenshots — send only **short text summaries** (≤ 2 lines).
- Minimize per-request context (last 30–60s summary, not the full transcript).

### Consent & controls
- “Smart Mode (uses AI)” toggle with suboptions:
  - **Local only** (no network)
  - **Allow Gemini for chat** (client)
  - **Allow Genkit summaries** (server, after class)
- Clear inline note: “No student audio/video is uploaded. Text is redacted before AI.”

---

## 3) Architecture Overview

### Client (browser)
- **Extractors (local):** `MicTranscript`, `ScreenText`, `TopicDetector`
- **Engagement Engine:** decides if/what to emit (`seed` vs `followup`)
- **Generators (strategy):**
  - `scripted.generate(ctx)` (Level 1)
  - `gemini.generate(ctx)` via **Firebase AI Logic** (Level 3)
- **Moderator:** local blocklist/regex (+ TF.js optional)
- **Dispatcher:** renders chat items

### Server (optional, later)
- **Genkit on Cloud Functions** for:
  - Post-class summaries & analytics
  - Optional augmentation (e.g., key moments)
- **Firestore/Storage** (if cloud sync is enabled)

---

## 4) Interfaces (stable)

```ts
// ai/types.ts
export type BotPersona = 'emma' | 'jay' | 'noor' | 'ben';

export interface ContextSlice {
  topic?: string;               // e.g., "Arrays", "Extrude"
  lastTranscript?: string;      // 1–2 sentences max (local)
  lastRealQuestion?: string;    // recent student Q (sanitized)
  vibe?: 'quiet' | 'normal' | 'energetic';
}

export interface BotMessage {
  persona: BotPersona;
  text: string;
}

export interface GeneratorStrategy {
  generate(ctx: ContextSlice): Promise<BotMessage | null>;
}

export interface Moderation {
  filter(input: string): { allowed: boolean; redacted?: string; reason?: string };
}

Strategies you can swap:
	•	ScriptedGenerator (Level 1)
	•	GeminiGenerator (Level 3, via Firebase AI Logic)
	•	NullGenerator (disabled)

⸻

5) Implementation Tiers

Level 1 — Scripted (no AI)
	•	Triggers: topic change, idle > N sec, real student Q detected.
	•	Template bank: 10–12 “kid voice” seed questions + 4 follow-ups per topic.
	•	Piggyback: simple rules: if lastRealQuestion within 20s → pick follow-up.
	•	Rate limits: max 1 bot msg / 45–90s; cooldown after teacher answers (overlay state change).
	•	Moderation: local filter first; drop or redact if needed.

Level 3 (client) — Firebase AI Logic (Gemini)
	•	Prompt discipline: 1–2 lines of context; persona instruction; max 12 words; ask 1 question only.
	•	Gate: local intent classifier → only call if there’s a reason to ask.
	•	Limits: at most 1 call / 60s in “Normal”; 1 / 120s in “Light”.
	•	Fallback: if call fails or exceeds budget → use scripted generator.
	•	PII: send only redacted, summarized text.

Level 3 (server) — Genkit (post-class)
	•	Inputs: event log + teacher overlay text + (optional) transcript summary file.
	•	Pipeline: redact → chunk → summarize → store.
	•	Outputs: “3 key questions”, “moments timeline”, “engagement graph notes”.
	•	Access: only to the owning teacher; never cross-class aggregation unless anonymized.

⸻

6) Moderation Plan

MVP (local):
	•	Normalize text (case/diacritics); l33t substitution map.
	•	Blocklist + category flags (profanity, PII patterns: emails, phones).
	•	Rate limiting per device (e.g., 1 msg / 3s, burst 3).
	•	Actions: drop, redact (■■■), or replace with emoji.

Level 2 (optional):
	•	TF.js toxicity model as a second signal (still local).

Level 3 (optional cloud):
	•	Cloud moderation API (toggle), last-resort only.

⸻

7) Cost Controls
	•	Strict throttle: 1 LLM call per 30–120s (configurable by mode).
	•	Tiny prompts: persona + 2 lines context; target ≤ 200–300 tokens total.
	•	Session budget: cap calls per class (e.g., 20). Visual meter in UI.
	•	Teacher toggles: Off / Light / Normal.

Rough estimate (Gemini-class model, tiny prompts): cents per 45-min session under tight limits.

⸻

8) Prompts (starter)

System (persona):

You are Emma, a curious and kind 6th-grade student in tech class.
Ask one short, genuine question that helps you understand the topic.
No slang beyond mild. ≤ 12 words. Never answer, only ask.

User (context):
Topic: Arrays
Last transcript: "Index starts at 0. Arrays store multiple values."
Last student question: "Do arrays have a size limit?"
Task: Ask one follow-up question.

9) Rollout Plan
	•	Phase A (now): Ship Level 1 scripted bots + moderation. Toggle: “Classmates (Fun)”.
	•	Phase B: Add “Smart Mode (Gemini)” via Firebase AI Logic with strict rate limits.
	•	Phase C: Add Genkit summaries for post-class (opt-in), stored per teacher.
	•	Phase D: Optional Memify mode (templates → generative).

⸻

10) Telemetry (opt-in)
	•	Count of bot messages emitted (by strategy).
	•	LLM call count + average tokens + failures.
	•	Moderator actions taken (drop/redact).
	•	Teacher mode usage (Off/Light/Normal).

(All anonymous or per-teacher only; no student IDs.)

⸻

11) Tasks (first tickets)
	•	ai/ module skeleton with interfaces in §4.
	•	ScriptedGenerator + template bank (Arrays, Variables, Loops, Extrude, Redstone, etc.).
	•	Moderation MVP (blocklist/regex/rate-limit).
	•	“Classmates” settings: Off / Light / Normal (+ Smart toggle placeholder).
	•	Firebase AI Logic setup (env guard) + GeminiGenerator stub (disabled by default).
	•	Genkit placeholder Cloud Function (no-op) for summaries.
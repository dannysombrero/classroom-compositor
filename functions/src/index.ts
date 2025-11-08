// functions/src/index.ts
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";

admin.initializeApp();
const app = express();
app.use(cors({ origin: true }));
app.options("*", (_req, res) => res.status(204).send(""));
app.use(express.json());

// In-memory (dev)
type Session = { id: string; hostId: string; createdAt: number; active: boolean; code?: string; };
const sessions = new Map<string, Session>();
const codeToSession = new Map<string, string>();

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const rand = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
const base32 = (n: number) => ALPHABET[n & 31];
const checksum = (raw: string) => base32([...raw].reduce((a, ch) => a + ALPHABET.indexOf(ch), 0) % 32);
function genCode() {
  const raw = Array.from({ length: 6 }, rand).join("");
  return `${raw.slice(0, 3)}-${raw.slice(3)}${checksum(raw)}`;
}

// Create: POST /sessions
app.post("/sessions", (req, res) => {
  const hostId = String(req.body?.hostId ?? "host");
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const code = genCode();
  const session: Session = { id, hostId, createdAt: Date.now(), active: true, code };
  sessions.set(id, session);
  codeToSession.set(code.replace(/-/g, ""), id);
  return res.json({ ...session, code });
});

// Resolve: GET /codes/:code  ← this is the “codes” route
app.get("/joinCodes/:code", (req, res) => {
  const key = req.params.code.replace(/-/g, "");
  const sessionId = codeToSession.get(key);
  if (!sessionId) return res.status(404).json({ error: "invalid_code" });
  const s = sessions.get(sessionId);
  if (!s || !s.active) return res.status(410).json({ error: "not_live" });
  return res.json({ sessionId });
});

// Check: GET /sessions/:id
app.get("/sessions/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  return res.json({ active: !!(s && s.active) });
});

// End: DELETE /sessions/:id
app.delete("/sessions/:id", (req, res) => {
  const s = sessions.get(req.params.id);
  if (s) {
    s.active = false;
    if (s.code) codeToSession.delete(s.code.replace(/-/g, ""));
    sessions.set(s.id, s);
  }
  return res.status(204).end();
});

export const appApi = functions.https.onRequest(app);
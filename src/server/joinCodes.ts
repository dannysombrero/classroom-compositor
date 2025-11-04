// server/joinCodes.ts
import { Router } from "express";
import { sessions } from "./sessions";

const codes = new Map<string, { sessionId: string; expiresAt: number }>();
const router = Router();

router.post("/api/join-codes", (req, res) => {
  const { code, sessionId, expiresAt } = req.body ?? {};
  if (!code || !sessionId || !expiresAt) return res.status(400).end();
  if (!sessions.has(sessionId)) return res.status(404).json({ error: "No session" });
  codes.set(code.replace(/-/g, ""), { sessionId, expiresAt });
  res.status(201).end();
});

router.get("/api/join-codes/:code", (req, res) => {
  const key = req.params.code.replace(/-/g, "");
  const rec = codes.get(key);
  if (!rec) return res.status(404).json({ error: "Not found" });
  if (Date.now() > rec.expiresAt) {
    codes.delete(key);
    return res.status(410).json({ error: "Expired" });
  }
  res.json({ sessionId: rec.sessionId });
});

router.delete("/api/join-codes/:code", (req, res) => {
  codes.delete(req.params.code.replace(/-/g, ""));
  res.status(204).end();
});

export default router;
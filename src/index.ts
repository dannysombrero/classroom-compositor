import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import express from "express";

admin.initializeApp();
const db = admin.firestore();
const app = express();
app.use(express.json());

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const rand = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
const base32 = (n:number) => ALPHABET[n & 31];
const checksum = (raw:string) => base32([...raw].reduce((a,ch)=>a+ALPHABET.indexOf(ch),0)%32);
function genCode(){ const raw=Array.from({length:6},rand).join(""); return `${raw.slice(0,3)}-${raw.slice(3)}${checksum(raw)}`; }

app.post("/api/sessions", async (req, res) => {
  const { hostId } = req.body ?? {};
  const sessionId = db.collection("_ids").doc().id;
  const createdAt = Date.now();
  let code = genCode();
  for (let i=0;i<5;i++){
    const clean = code.replace(/-/g,"");
    const exists = await db.doc(`joinCodes/${clean}`).get();
    if (!exists.exists){
      await db.doc(`joinCodes/${clean}`).set({ sessionId, createdAt });
      await db.doc(`sessions/${sessionId}`).set({ hostId: hostId ?? "host", createdAt, active: true, code });
      return res.json({ id: sessionId, createdAt, hostId: hostId ?? "host", code });
    }
    code = genCode();
  }
  res.status(503).json({ error: "could_not_allocate_code" });
});

app.get("/api/sessions/:id", async (req, res) => {
  const snap = await db.doc(`sessions/${req.params.id}`).get();
  if (!snap.exists) return res.status(404).json({ error: "not_found" });
  const d = snap.data()!;
  res.json({ id: req.params.id, active: !!d.active, hostId: d.hostId, createdAt: d.createdAt });
});

app.delete("/api/sessions/:id", async (req, res) => {
  const sid = req.params.id;
  const ref = db.doc(`sessions/${sid}`);
  const snap = await ref.get();
  if (snap.exists) {
    const d = snap.data()!;
    await ref.set({ active: false, endedAt: Date.now() }, { merge: true });
    if (d.code) await db.doc(`joinCodes/${String(d.code).replace(/-/g,"")}`).delete().catch(()=>{});
    await db.recursiveDelete(db.collection(`sessions/${sid}/signal`)).catch(()=>{});
    await db.recursiveDelete(db.collection(`sessions/${sid}/candidates`)).catch(()=>{});
  }
  res.status(204).end();
});

app.get("/api/join-codes/:code", async (req, res) => {
  const clean = req.params.code.replace(/-/g, "");
  const snap = await db.doc(`joinCodes/${clean}`).get();
  if (!snap.exists) return res.status(404).json({ error: "not_found" });
  const { sessionId } = snap.data() as any;
  const s = await db.doc(`sessions/${sessionId}`).get();
  if (!s.exists) return res.status(404).json({ error: "session_not_found" });
  if (!s.data()!.active) return res.status(410).json({ error: "inactive" });
  res.json({ sessionId });
});

export const appApi = functions.https.onRequest(app);
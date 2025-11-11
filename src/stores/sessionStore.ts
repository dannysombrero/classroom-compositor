import { create } from "zustand";
import { db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { generateJoinCode } from "../utils/joinCodes";

// Optional API base for local emulator HTTP endpoints (leave empty in prod)
const API = "";
console.log("API base is:", API);

// --- Types ---
export type SessionInfo = {
  id: string;
  hostId: string;
  code?: string;
  createdAt?: number | null; // optional because we write serverTimestamp()
};

type State = {
  session: SessionInfo | null;
  joinCode: string | null;
  isJoinCodeActive: boolean;
  goLive: (hostId: string) => Promise<void>;
  endLive: () => Promise<void>;
};

// --- Helpers ---

// Fallback: create a session directly in Firestore when no local emulator/HTTP API is available.
async function clientCreateSession(hostId: string): Promise<{ id: string; code: string }> {
  const now = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const sessionId = `${now}-${rand}`;

  // Assumes your generateJoinCode() returns { pretty: "ABC-123", id: "ABC123" }
  const { pretty, id } = generateJoinCode();

  // sessions/{sessionId}
  const sessionRef = doc(db, "sessions", sessionId);
  await setDoc(
    sessionRef,
    {
      id: sessionId,
      hostId,
      createdAt: serverTimestamp(),
      active: true,
      code: pretty,
    },
    { merge: true }
  );

  // joinCodes/{id} → { sessionId, active }
  const codeRef = doc(db, "joinCodes", id);
  await setDoc(
    codeRef,
    {
      sessionId,
      active: true,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  return { id: sessionId, code: pretty };
}

// --- Store ---
export const useSessionStore = create<State>((set, get) => ({
  session: null,
  joinCode: null,
  isJoinCodeActive: false,

  async goLive(hostId: string) {
    try {
      // Try Functions API first
      const res = await fetch(`/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId }),
      });
      
      if (res.ok) {
        const text = await res.text();
        const session = JSON.parse(text);
        set({ session, joinCode: session.code, isJoinCodeActive: true });
        return;
      }
      
      // Fall back to client-side Firestore
      console.log("[goLive] /api/sessions failed, using client-side Firestore");
      
      const { db, doc, setDoc } = await import("../firebase");
      const { activateJoinCode } = await import("../utils/joinCodes");
      
      // Create session
      const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      await setDoc(doc(db, "sessions", sessionId), {
        id: sessionId,
        hostId,
        createdAt: Date.now(),
        active: true
      });
      
      // Generate and activate join code
      const { codePretty: joinCode } = await activateJoinCode(sessionId);
      
      set({ 
        session: { id: sessionId, createdAt: Date.now(), hostId, code: joinCode },
        joinCode,
        isJoinCodeActive: true 
      });
      
    } catch (e) {
      console.error("goLive failed:", e);
      alert("Couldn't start a live session. Check console for details.");
    }
  },

  async endLive() {
    const s = get().session;
    if (!s) return;
    try {
      // If you have a local API for stopping, call it; otherwise just clear client state.
      if (API) {
        await fetch(`${API}/sessions/${s.id}`, { method: "DELETE" }).catch(() => {});
      }
    } finally {
      set({ session: null, joinCode: null, isJoinCodeActive: false });
    }
  },
}));
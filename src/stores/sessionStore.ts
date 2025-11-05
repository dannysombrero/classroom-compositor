import { create } from "zustand";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
// ... your helpers (rand/base32/checksum) if you still have them ...

// 👇 TOP-LEVEL (outside the store)
const API = "";
console.log("API base is:", API);

export type SessionInfo = { id: string; createdAt: number; hostId: string; code?: string };

type State = {
  session: SessionInfo | null;
  joinCode: string | null;
  isJoinCodeActive: boolean;
  goLive: (hostId: string) => Promise<void>;
  endLive: () => Promise<void>;
};

export const useSessionStore = create<State>((set, get) => ({
  session: null,
  joinCode: null,
  isJoinCodeActive: false,

  async goLive(hostId: string) {
    try {
      const res = await fetch(`/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
      const session = JSON.parse(text);
      set({ session, joinCode: session.code, isJoinCodeActive: true });
    } catch (e) {
      console.error("goLive failed:", e);
      alert("Couldn’t start a live session. Is the emulator running?");
    }
  },

  async endLive() {
    const s = get().session;
    if (!s) return;
    try {
      await fetch(`${API}/sessions/${s.id}`, { method: "DELETE" });
    } finally {
      set({ session: null, joinCode: null, isJoinCodeActive: false });
    }
  },
}));
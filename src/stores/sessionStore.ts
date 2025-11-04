import { create } from "zustand";

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

  async goLive(hostId) {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostId }),
    });
    if (!res.ok) throw new Error("Failed to create session");
    const session = await res.json(); // { id, createdAt, hostId, code }
    set({ session, joinCode: session.code, isJoinCodeActive: true });
  },

  async endLive() {
    const s = get().session;
    if (s) await fetch(`/api/sessions/${s.id}`, { method: "DELETE" });
    set({ session: null, joinCode: null, isJoinCodeActive: false });
  },
}));
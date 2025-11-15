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

export type SessionStreamEntry = {
  id: string;
  label?: string;
  createdAt: number;
  updatedAt: number;
  status: "available" | "in-use" | "ended";
  viewerIds: string[];
};

type State = {
  session: SessionInfo | null;
  joinCode: string | null;
  isJoinCodeActive: boolean;
  goLive: (hostId: string) => Promise<void>;
  endLive: () => Promise<void>;
  streams: Record<string, SessionStreamEntry>;
  registerStream: (
    id: string,
    stream: MediaStream,
    metadata?: Partial<Omit<SessionStreamEntry, "id">>,
  ) => void;
  releaseStream: (id: string) => void;
  markStreamInUse: (id: string, viewerId: string) => void;
  getStream: (id: string) => MediaStream | null;
};

const streamObjects = new Map<string, MediaStream>();

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
  streams: {},

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
  registerStream(id, stream, metadata) {
    streamObjects.set(id, stream);
    const now = Date.now();
    set((state) => ({
      streams: {
        ...state.streams,
        [id]: {
          id,
          label: metadata?.label,
          status: metadata?.status ?? "available",
          viewerIds: metadata?.viewerIds ?? [],
          createdAt: metadata?.createdAt ?? now,
          updatedAt: now,
        },
      },
    }));
  },
  releaseStream(id) {
    streamObjects.delete(id);
    set((state) => {
      if (!state.streams[id]) return state;
      return {
        streams: {
          ...state.streams,
          [id]: {
            ...state.streams[id],
            status: "ended",
            viewerIds: [],
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  markStreamInUse(id, viewerId) {
    set((state) => {
      const entry = state.streams[id];
      if (!entry) return state;
      const viewerIds = entry.viewerIds.includes(viewerId)
        ? entry.viewerIds
        : [...entry.viewerIds, viewerId];
      return {
        streams: {
          ...state.streams,
          [id]: {
            ...entry,
            viewerIds,
            status: "in-use",
            updatedAt: Date.now(),
          },
        },
      };
    });
  },
  getStream(id) {
    const stream = streamObjects.get(id) ?? null;
    if (stream) {
      set((state) => {
        const entry = state.streams[id];
        if (!entry) return state;
        return {
          streams: {
            ...state.streams,
            [id]: {
              ...entry,
              updatedAt: Date.now(),
            },
          },
        };
      });
    }
    return stream;
  },
}));

export function registerSessionStream(
  id: string,
  stream: MediaStream,
  metadata?: Partial<Omit<SessionStreamEntry, "id" | "createdAt" | "updatedAt">>,
): void {
  useSessionStore.getState().registerStream(id, stream, metadata);
}

export function releaseSessionStream(id: string): void {
  useSessionStore.getState().releaseStream(id);
}

export function markSessionStreamInUse(id: string, viewerId: string): void {
  useSessionStore.getState().markStreamInUse(id, viewerId);
}

export function getRegisteredStream(id: string): MediaStream | null {
  return useSessionStore.getState().getStream(id);
}
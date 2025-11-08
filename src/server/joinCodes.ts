// src/utils/joinCodes.ts
import { db, doc, setDoc, deleteDoc } from "../firebase";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/O/1/0
const TTL_MS = 5 * 60 * 1000;

const rand = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];

export function generateJoinCode() {
  // 6 characters, displayed as ABC-123, id is ABC123 (no checksum)
  const raw = Array.from({ length: 6 }, rand).join("");
  const pretty = `${raw.slice(0, 3)}-${raw.slice(3, 6)}`;
  return { pretty, id: pretty.replace(/-/g, "") };
}

/** Create/activate a code document the viewer can resolve. */
export async function activateJoinCode(sessionId: string) {
  const { pretty, id } = generateJoinCode();
  const expiresAt = Date.now() + TTL_MS;

  await setDoc(doc(db, "joinCodes", id), {
    sessionId,
    active: true,
    createdAt: Date.now(),
    expiresAt,
  });

  return { codePretty: pretty, codeId: id, expiresAt };
}

export async function deactivateJoinCode(codeId: string) {
  await deleteDoc(doc(db, "joinCodes", codeId));
}
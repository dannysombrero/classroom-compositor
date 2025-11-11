// src/utils/joinCodes.ts
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/O/1/0
const TTL_MS = 5 * 60 * 1000;

const rand = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];

export function generateJoinCode() {
  // 6 characters, displayed as ABC-123, stored as ABC123
  const raw = Array.from({ length: 6 }, rand).join("");
  const pretty = `${raw.slice(0, 3)}-${raw.slice(3)}`; // ABC-123
  return { pretty, id: raw }; // store without dash
}

/**
 * Create/activate a code document the viewer can resolve.
 * Caller must pass a valid `sessionId`.
 */
export async function activateJoinCode(sessionId: string) {
  const { pretty, id } = generateJoinCode();
  const expiresAt = Date.now() + TTL_MS;

  await setDoc(
    doc(db, "joinCodes", id),
    {
      sessionId,
      active: true,
      createdAt: Date.now(),
      expiresAt,
    },
    { merge: true }
  );

  return { codePretty: pretty, codeId: id, expiresAt };
}
// src/utils/joinCodes.ts
import { serverTimestamp } from "firebase/firestore";
import { db, doc, setDoc, deleteDoc } from "../firebase";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I/O/1/0
const TTL_MS = 5 * 60 * 1000;

const rand = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
const base32 = (n: number) => ALPHABET[n & 31];
const checksum = (raw: string) =>
  base32([...raw].reduce((a, ch) => a + ALPHABET.indexOf(ch), 0) % 32);

export function generateJoinCode() {
  const raw = Array.from({ length: 6 }, rand).join("");
  const pretty = `${raw.slice(0, 3)}-${raw.slice(3)}${checksum(raw)}`;
  return { pretty, id: pretty.replace(/-/g, "") };
}

export async function activateJoinCode(sessionId: string) {
  const { pretty, id } = generateJoinCode();
  const expiresAt = Date.now() + TTL_MS;
  await setDoc(doc(db, "codes", id), {
    sessionId,
    active: true,
    createdAt: Date.now(),
    expiresAt,
  });
  return { codePretty: pretty, codeId: id, expiresAt };
}

export async function deactivateJoinCode(codeId: string) {
  await deleteDoc(doc(db, "codes", codeId));
}
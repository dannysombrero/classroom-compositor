import { initializeApp } from "firebase/app";
import {
  getFirestore,
  // connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// ---- Firebase Config (Vite env) ----
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
  console.warn("[firebase] Missing VITE_FIREBASE_* env vars. Firestore/Auth may not work until configured.");
} else {
  console.log(`[firebase] Using project ${firebaseConfig.projectId}`);
}

const app = initializeApp(firebaseConfig);

// ---- Firestore ----
export const db = getFirestore(app);
// For local emulator testing, if needed:
// connectFirestoreEmulator(db, "127.0.0.1", 8080);

// ---- Auth (anonymous) ----
// Guarded so missing/invalid API keys don't crash dev.
let _auth: ReturnType<typeof getAuth> | null = null;
try {
  _auth = getAuth(app);
  onAuthStateChanged(_auth, (u) => {
    if (!u) {
      // Fire-and-forget; avoid unhandled promise rejection
      signInAnonymously(_auth!).catch(() => {});
    }
  });
  // Kick once on load
  signInAnonymously(_auth).catch(() => {});
} catch (e) {
  console.warn("[firebase] Auth not initialized (likely missing/invalid config). Set VITE_FIREBASE_* env vars.", e);
}
export const auth = _auth;

// ---- Re-exports for convenience ----
export { doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc };
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  // connectFirestoreEmulator,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
} from "firebase/firestore";

// ---- Firebase Config (Vite env) ----
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
  console.warn("[firebase] Missing VITE_FIREBASE_* env vars. Firestore may not work until configured.");
} else {
  console.log(`[firebase] Using project ${firebaseConfig.projectId}`);
}

const app = initializeApp(firebaseConfig);

// ---- Firestore ----
export const db = getFirestore(app);
// For local emulator testing, if needed:
// connectFirestoreEmulator(db, "127.0.0.1", 8080);

// ---- Re-exports for convenience ----
export { doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc };
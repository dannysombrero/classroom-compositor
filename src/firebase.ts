import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
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

// ---- Firestore (force long-polling to avoid QUIC/WebChannel issues) ----
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,         // <— force
  experimentalAutoDetectLongPolling: false,   // <— don’t auto; we force it
});

// For local emulator testing, if needed:
// connectFirestoreEmulator(db, "127.0.0.1", 8080);

// ---- Re-exports for convenience ----
export { doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc };
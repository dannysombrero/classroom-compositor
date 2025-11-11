import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

console.log("[firebase] Using project", firebaseConfig.projectId);

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Connect to emulator in dev mode
if (import.meta.env.DEV) {
  try {
    // connectFirestoreEmulator(db, "127.0.0.1", 8080);
    console.log("🔧 [firebase] Connected to Firestore Emulator at localhost:8080");
  } catch (err: any) {
    if (err.code === 'failed-precondition') {
      console.log("ℹ️ [firebase] Emulator already connected");
    } else {
      console.warn("⚠️ [firebase] Could not connect to emulator:", err);
    }
  }
}

// Re-export Firestore functions
export {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
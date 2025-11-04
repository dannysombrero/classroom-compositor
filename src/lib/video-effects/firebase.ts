import { initializeApp } from "firebase/app";
import {
  getFirestore, connectFirestoreEmulator,
  doc, setDoc, getDoc, onSnapshot,
  collection, addDoc, deleteDoc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "341857819113",
  authDomain: "https://classcast-app.web.app/",
  projectId: "classcast-app",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// For local emu testing, uncomment:
// connectFirestoreEmulator(db, "127.0.0.1", 8080);

export { doc, setDoc, getDoc, onSnapshot, collection, addDoc, deleteDoc };
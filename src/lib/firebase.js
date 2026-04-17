import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTIowTqTX-0dhSQKimkgCZUgEVtN3p_MI",
  authDomain: "crest-io.firebaseapp.com",
  projectId: "crest-io",
  storageBucket: "crest-io.firebasestorage.app",
  messagingSenderId: "162143185990",
  appId: "1:162143185990:web:035b2ad2a9bb6f73532e47",
  measurementId: "G-8E5YRW9ZXD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Restrict to SafetyCulture domain
googleProvider.setCustomParameters({
  hd: "safetyculture.io"
});

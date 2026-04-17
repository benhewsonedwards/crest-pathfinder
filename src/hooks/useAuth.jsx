import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Enforce safetyculture.io domain
        if (!firebaseUser.email?.endsWith("@safetyculture.io")) {
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        setUser(firebaseUser);
        // Load or create user profile in Firestore
        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setProfile(snap.data());
        } else {
          const newProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            role: "viewer", // default — admin promotes
            team: null,
            jobFunction: null,
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp(),
          };
          await setDoc(ref, newProfile);
          setProfile(newProfile);
        }
        // Update last seen
        await setDoc(ref, { lastSeen: serverTimestamp() }, { merge: true });
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function login() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login error:", err);
      throw err;
    }
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

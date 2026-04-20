import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";
import { personByEmail } from "../lib/people";

const AuthContext = createContext(null);

// Map people directory role keys to CREST app roles
function roleFromDirectoryKey(roleKey) {
  switch (roleKey) {
    case "cse":     return "cse";
    case "com":     return "com";
    case "im":      return "com";      // Implementation managers get COM-level access
    case "csm":     return "csm";
    case "ae":      return "viewer";   // AEs can view but not edit
    case "manager": return "admin";    // Edwin gets admin
    default:        return "viewer";
  }
}

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

        // Look up this person in the directory
        const directoryPerson = personByEmail(firebaseUser.email);

        const ref = doc(db, "users", firebaseUser.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const existing = snap.data();
          // Merge directory data in case it's been updated, but preserve manually-set role
          const updates = {
            lastSeen: serverTimestamp(),
            // Link to directory data if not already set
            ...(directoryPerson && !existing.directoryEmail ? {
              directoryEmail:  directoryPerson.email,
              displayName:     directoryPerson.name,
              roleKey:         directoryPerson.roleKey,
              title:           directoryPerson.title,
              location:        directoryPerson.location,
              team:            directoryPerson.team,
              initials:        directoryPerson.initials,
              // Only auto-upgrade role if still on default 'viewer'
              ...(existing.role === "viewer" ? { role: roleFromDirectoryKey(directoryPerson.roleKey) } : {}),
            } : {}),
          };
          await setDoc(ref, updates, { merge: true });
          setProfile({ ...existing, ...updates });
        } else {
          // First sign-in — create profile from directory data if available
          const newProfile = {
            uid:          firebaseUser.uid,
            email:        firebaseUser.email,
            displayName:  directoryPerson?.name      || firebaseUser.displayName,
            photoURL:     firebaseUser.photoURL,
            role:         directoryPerson ? roleFromDirectoryKey(directoryPerson.roleKey) : "viewer",
            // Directory fields
            directoryEmail: directoryPerson?.email   || null,
            roleKey:      directoryPerson?.roleKey   || null,
            title:        directoryPerson?.title     || null,
            location:     directoryPerson?.location  || null,
            team:         directoryPerson?.team      || null,
            initials:     directoryPerson?.initials  || null,
            createdAt:    serverTimestamp(),
            lastSeen:     serverTimestamp(),
          };
          await setDoc(ref, newProfile);
          setProfile(newProfile);
        }
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

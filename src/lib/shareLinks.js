import { collection, addDoc, getDocs, doc, updateDoc, query, where, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "./firebase";

/** Generate a cryptographically random URL-safe token */
export function generateToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

/** Create a new share link for a customer engagement */
export async function createShareLink({ customerId, customerName, engagementId, createdByName, createdByEmail, label }) {
  const token = generateToken();
  const ref = await addDoc(collection(db, "shareLinks"), {
    token,
    customerId,
    customerName,
    engagementId:  engagementId || null,
    label:         label || customerName,
    createdByName: createdByName || "Unknown",
    createdByEmail:createdByEmail || "",
    createdAt:     serverTimestamp(),
    active:        true,
    lastAccessedAt:null,
    accessCount:   0,
  });
  return { id: ref.id, token };
}

/** Load a share link by token — returns null if not found or inactive */
export async function loadShareLinkByToken(token) {
  if (!token) return null;
  const snap = await getDocs(query(collection(db, "shareLinks"), where("token", "==", token)));
  if (snap.empty) return null;
  const linkDoc = snap.docs[0];
  const data = { id: linkDoc.id, ...linkDoc.data() };
  if (!data.active) return null;

  // Track access
  await updateDoc(doc(db, "shareLinks", linkDoc.id), {
    lastAccessedAt: serverTimestamp(),
    accessCount: (data.accessCount || 0) + 1,
  });
  return data;
}

/** Deactivate a share link */
export async function deactivateShareLink(linkId) {
  await updateDoc(doc(db, "shareLinks", linkId), { active: false });
}

/** Reactivate a share link */
export async function reactivateShareLink(linkId) {
  await updateDoc(doc(db, "shareLinks", linkId), { active: true });
}

/** Load all share links (for the management page) */
export async function loadAllShareLinks() {
  const snap = await getDocs(query(collection(db, "shareLinks")));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const at = a.createdAt?.toMillis?.() || 0;
      const bt = b.createdAt?.toMillis?.() || 0;
      return bt - at;
    });
}

/** Build the full share URL from a token */
export function shareUrl(token) {
  return `${window.location.origin}${window.location.pathname}#/s/${token}`;
}

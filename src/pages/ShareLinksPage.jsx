import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { createShareLink, deactivateShareLink, reactivateShareLink, shareUrl } from "../lib/shareLinks";
import { Card, CardHeader, Label, Pill, Btn, Spinner, Modal, FieldGroup, Input } from "../components/UI";

function timeAgo(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      style={{
        fontSize: 11, padding: "4px 10px", borderRadius: 6,
        border: "1px solid var(--border)", background: copied ? "var(--green-light)" : "var(--surface2)",
        color: copied ? "var(--green)" : "var(--text-second)", cursor: "pointer", fontFamily: "inherit",
        transition: "all 0.15s",
      }}
    >
      {copied ? "✓ Copied" : "Copy link"}
    </button>
  );
}

export default function ShareLinksPage() {
  const { profile } = useAuth();
  const [links, setLinks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [form, setForm]       = useState({ customerId: "", label: "" });
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink]   = useState(null); // { url } — shown after creation
  const [toggling, setToggling] = useState({}); // { linkId: true }

  const isAdmin = ["super_admin", "admin", "cse", "com"].includes(profile?.role);

  useEffect(() => {
    // Load share links realtime
    const unsub = onSnapshot(
      collection(db, "shareLinks"),
      snap => {
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setLinks(all);
        setLoading(false);
      }
    );
    // Load customers for the create form
    const unsub2 = onSnapshot(collection(db, "customers"), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)));
    });
    return () => { unsub(); unsub2(); };
  }, []);

  async function handleCreate() {
    if (!form.customerId) return;
    setCreating(true);
    const customer = customers.find(c => c.id === form.customerId);
    const { token } = await createShareLink({
      customerId:    form.customerId,
      customerName:  customer?.name || "Unknown",
      label:         form.label || customer?.name || "Customer view",
      createdByName: profile?.displayName || "Unknown",
      createdByEmail:profile?.email || "",
    });
    const url = shareUrl(token);
    setNewLink({ url });
    setForm({ customerId: "", label: "" });
    setCreating(false);
    setShowNew(false);
  }

  async function toggleLink(link) {
    setToggling(t => ({ ...t, [link.id]: true }));
    if (link.active) {
      await deactivateShareLink(link.id);
    } else {
      await reactivateShareLink(link.id);
    }
    setToggling(t => ({ ...t, [link.id]: false }));
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <Spinner size={28} />
    </div>
  );

  const activeLinks   = links.filter(l => l.active);
  const inactiveLinks = links.filter(l => !l.active);

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Shared customer links</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {activeLinks.length} active · {inactiveLinks.length} inactive · Each link uses a unique token — no password required
          </p>
        </div>
        {isAdmin && (
          <Btn onClick={() => setShowNew(true)}>+ New link</Btn>
        )}
      </div>

      {/* Info banner */}
      <div style={{
        background: "var(--purple-light)", border: "1px solid var(--purple-tint)",
        borderRadius: "var(--radius)", padding: "12px 16px", marginBottom: 20,
        fontSize: 12, color: "var(--text-second)", lineHeight: 1.6,
      }}>
        <strong style={{ color: "var(--purple)" }}>How it works:</strong> Each link contains a unique 32-character token. The customer doesn't need a password — just the link. They can view their engagement progress, mark tasks complete, add notes, and upload files. Deactivating a link immediately blocks access.
      </div>

      {links.length === 0 ? (
        <Card style={{ padding: "32px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🔗</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>No share links yet</p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Create a link to share an engagement progress view with a customer.</p>
          {isAdmin && <Btn onClick={() => setShowNew(true)}>+ Create first link</Btn>}
        </Card>
      ) : (
        <>
          {/* Active links */}
          {activeLinks.length > 0 && (
            <Card style={{ marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 80px 120px 100px", gap: 10, padding: "7px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                <Label>Customer</Label>
                <Label>Created by</Label>
                <Label>Created</Label>
                <Label>Accesses</Label>
                <Label>Last accessed</Label>
                <Label>Actions</Label>
              </div>
              {activeLinks.map((link, i) => (
                <div key={link.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 120px 120px 80px 120px 100px",
                  gap: 10, padding: "12px 18px", alignItems: "center",
                  borderBottom: i < activeLinks.length - 1 ? "1px solid var(--border)" : "none",
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{link.label || link.customerName}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {shareUrl(link.token).replace(window.location.origin, "")}
                    </p>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-second)" }}>{link.createdByName?.split(" ")[0] || "—"}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{timeAgo(link.createdAt)}</span>
                  <span style={{ fontSize: 12, color: link.accessCount > 0 ? "var(--green)" : "var(--text-muted)", fontWeight: link.accessCount > 0 ? 600 : 400 }}>
                    {link.accessCount || 0}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{timeAgo(link.lastAccessedAt)}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <CopyBtn text={shareUrl(link.token)} />
                    {isAdmin && (
                      <button
                        onClick={() => toggleLink(link)}
                        disabled={toggling[link.id]}
                        style={{
                          fontSize: 11, padding: "4px 8px", borderRadius: 6,
                          border: "1px solid var(--border)", background: "transparent",
                          color: "var(--red)", cursor: "pointer", fontFamily: "inherit",
                          transition: "all 0.15s",
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = "var(--red-light)"; e.currentTarget.style.borderColor = "var(--red)"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--border)"; }}
                        title="Deactivate — immediately blocks customer access"
                      >
                        {toggling[link.id] ? "..." : "Deactivate"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* Inactive links */}
          {inactiveLinks.length > 0 && (
            <div>
              <p style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Deactivated links</p>
              <Card style={{ opacity: 0.7 }}>
                {inactiveLinks.map((link, i) => (
                  <div key={link.id} style={{
                    display: "grid", gridTemplateColumns: "1fr 120px 120px 80px 120px 100px",
                    gap: 10, padding: "11px 18px", alignItems: "center",
                    borderBottom: i < inactiveLinks.length - 1 ? "1px solid var(--border)" : "none",
                  }}>
                    <div>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 2 }}>{link.label || link.customerName}</p>
                      <Pill color="grey" style={{ fontSize: 9 }}>Deactivated</Pill>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{link.createdByName?.split(" ")[0] || "—"}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{timeAgo(link.createdAt)}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{link.accessCount || 0}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{timeAgo(link.lastAccessedAt)}</span>
                    {isAdmin && (
                      <button
                        onClick={() => toggleLink(link)}
                        disabled={toggling[link.id]}
                        style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--green)", cursor: "pointer", fontFamily: "inherit" }}
                      >
                        {toggling[link.id] ? "..." : "Reactivate"}
                      </button>
                    )}
                  </div>
                ))}
              </Card>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      <Modal open={showNew} onClose={() => { setShowNew(false); setForm({ customerId: "", label: "" }); }} title="Create share link" width={440}>
        <FieldGroup label="Customer" required>
          <select
            value={form.customerId}
            onChange={e => {
              const c = customers.find(c => c.id === e.target.value);
              setForm(f => ({ ...f, customerId: e.target.value, label: c?.name || "" }));
            }}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontFamily: "inherit", fontSize: 13, background: "var(--surface)", color: "var(--text-primary)", outline: "none" }}
          >
            <option value="">— select customer —</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FieldGroup>
        <FieldGroup label="Label (optional)">
          <Input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. OVO Energy — Integration Portal" />
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Shown in this management view only — not visible to the customer.</p>
        </FieldGroup>
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "var(--text-second)", lineHeight: 1.6 }}>
          A unique 32-character token will be generated. The customer only needs the link — no password required. You can deactivate it at any time from this page.
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowNew(false)}>Cancel</Btn>
          <Btn onClick={handleCreate} disabled={creating || !form.customerId}>
            {creating ? "Creating..." : "Create link"}
          </Btn>
        </div>
      </Modal>

      {/* New link created — show and copy */}
      <Modal open={!!newLink} onClose={() => setNewLink(null)} title="Link created ✓" width={500}>
        {newLink && (
          <div>
            <p style={{ fontSize: 13, color: "var(--text-second)", marginBottom: 14, lineHeight: 1.6 }}>
              Your share link is ready. Copy it and send it to your customer — they don't need a password.
            </p>
            <div style={{
              background: "var(--surface2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 14,
              fontFamily: "monospace", fontSize: 12, color: "var(--purple)",
              wordBreak: "break-all",
            }}>
              {newLink.url}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <CopyBtn text={newLink.url} />
              <Btn onClick={() => setNewLink(null)}>Done</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

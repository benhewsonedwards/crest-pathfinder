import { useState, useEffect } from "react";
import {
  collection, onSnapshot, query, where, orderBy,
  doc, addDoc, updateDoc, deleteDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { STAGES, STAGE_KEYS, RAG_STATUSES, TASK_TEMPLATES, fmtDate, timeAgo, stageColour } from "../lib/constants";
import { integrationStatus, ticketType, TICKET_TYPES } from "../lib/integrationConstants";
import {
  Card, CardHeader, Label, Pill, Avatar, Btn,
  Tabs, Input, Select, Textarea, Modal, FieldGroup, Spinner, EmptyState,
  useToast, ToastContainer
} from "../components/UI";
import IntegrationModal from "../components/IntegrationModal";

// ─── Mini Gantt for shareable view ────────────────────────────────────────────
const LABEL_W = 130; // px — must match the label span width below

function MiniGantt({ stageTasks }) {
  const allTasks = [];
  STAGE_KEYS.forEach(sk => (stageTasks?.[sk] || []).forEach(t => allTasks.push({ ...t, stageKey: sk })));
  const dated = allTasks.filter(t => t.startDate || t.endDate);
  if (!dated.length) return <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No tasks with dates yet</p>;

  const allDates = dated.flatMap(t => [t.startDate, t.endDate]).filter(Boolean).sort();
  const minDate = new Date(allDates[0]);
  const maxDate = new Date(allDates[allDates.length - 1]);
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 2);
  const span = maxDate - minDate;

  function xPct(iso) { return ((new Date(iso) - minDate) / span) * 100; }
  const todayPct = xPct(new Date().toISOString().slice(0, 10));
  const showToday = todayPct > 0 && todayPct < 100;

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: 500 }}>
        {dated.map((t, i) => {
          const colour = stageColour(t.stageKey);
          const x1 = xPct(t.startDate || t.endDate);
          const x2 = xPct(t.endDate || t.startDate);
          const w = Math.max(x2 - x1, 1.5);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
              {/* Fixed-width label */}
              <span style={{
                fontSize: 10, color: "var(--text-muted)",
                width: LABEL_W, flexShrink: 0,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                paddingRight: 8,
              }}>{t.title}</span>
              {/* Bar area — today line lives here */}
              <div style={{ flex: 1, position: "relative", height: 14 }}>
                {showToday && (
                  <div style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: `${todayPct}%`, width: 1.5,
                    background: "var(--amber)", zIndex: 2, opacity: 0.8,
                  }} />
                )}
                <div style={{
                  position: "absolute", left: `${x1}%`, width: `${w}%`, height: "100%",
                  background: t.done ? colour + "40" : colour + "70",
                  borderRadius: 3, borderLeft: `2px solid ${colour}`,
                }} />
              </div>
            </div>
          );
        })}
        {/* Today label under the chart */}
        {showToday && (
          <div style={{ display: "flex", marginTop: 2 }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            <div style={{ flex: 1, position: "relative", height: 12 }}>
              <span style={{
                position: "absolute", left: `${todayPct}%`,
                transform: "translateX(-50%)",
                fontSize: 8, color: "var(--amber)", fontWeight: 700, whiteSpace: "nowrap",
              }}>TODAY</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shareable view modal ─────────────────────────────────────────────────────
function ShareableView({ customer, integrations, engagements, onClose, onPublish }) {
  const latestEngagement = engagements.sort((a, b) => {
    const ai = STAGE_KEYS.indexOf(a.currentStage);
    const bi = STAGE_KEYS.indexOf(b.currentStage);
    return bi - ai;
  })[0];

  const allTickets = integrations.flatMap(i => (i.tickets || []).map(t => ({ ...t, integrationName: i.name })));
  const openTickets = allTickets.filter(t => t.status !== "done");

  return (
    <Modal open onClose={onClose} title={`Shareable view — ${customer.name}`} width={780}>
      <div style={{ background: "var(--surface2)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16, fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8 }}>
        <span>👁️</span>
        <span>This is a preview of the shareable customer view. When published, it will be accessible via a unique link without login.</span>
        <Btn size="sm" variant="ghost" style={{ marginLeft: "auto" }} onClick={() => { navigator.clipboard.writeText(window.location.href + "/share/" + customer.id); }}>Copy link</Btn>
      </div>

      {/* Account summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
        {[
          ["Segment", customer.segment],
          ["Region", customer.region],
          ["Subscription", customer.subscription],
          ["CSM", customer.csmName],
          ["COM", customer.comName],
          ["Integrations", integrations.length],
        ].filter(([,v]) => v).map(([k, v]) => (
          <div key={k} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px" }}>
            <Label style={{ marginBottom: 4, display: "block" }}>{k}</Label>
            <p style={{ fontSize: 13, fontWeight: 500 }}>{v}</p>
          </div>
        ))}
      </div>

      {/* Onboarding progress */}
      {latestEngagement && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>Onboarding progress</span>
            {(() => {
              const rag = RAG_STATUSES.find(r => r.key === latestEngagement.ragStatus) || RAG_STATUSES[0];
              return <Pill color={rag.key === "green" ? "green" : rag.key === "red" ? "red" : "amber"} style={{ fontSize: 10 }}>{rag.emoji} {rag.label}</Pill>;
            })()}
          </CardHeader>
          <div style={{ padding: 16 }}>
            {/* Stage progress */}
            <div style={{ display: "flex", marginBottom: 14 }}>
              {STAGES.map((s, i) => {
                const isCurrent = s.key === latestEngagement.currentStage;
                const isPast = STAGE_KEYS.indexOf(s.key) < STAGE_KEYS.indexOf(latestEngagement.currentStage);
                return (
                  <div key={s.key} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      {i > 0 && <div style={{ flex: 1, height: 2, background: isPast ? s.colour : "var(--border)" }} />}
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                        background: isCurrent ? s.colour : isPast ? s.colour + "30" : "var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10,
                      }}>
                        {isPast ? "✓" : isCurrent ? "●" : ""}
                      </div>
                      {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: "var(--border)" }} />}
                    </div>
                    <p style={{ fontSize: 9, marginTop: 4, color: isCurrent ? s.colour : "var(--text-muted)", fontWeight: isCurrent ? 700 : 400 }}>{s.shortLabel}</p>
                  </div>
                );
              })}
            </div>
            {/* Gantt */}
            <MiniGantt stageTasks={latestEngagement.stageTasks} />
          </div>
        </Card>
      )}

      {/* Integration portfolio */}
      {integrations.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader><span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>Integration portfolio</span></CardHeader>
          {integrations.map((i, idx) => {
            const st = integrationStatus(i.status);
            return (
              <div key={i.id} style={{ padding: "12px 18px", borderBottom: idx < integrations.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.colour, flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{i.name}</span>
                  <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 999, background: st.bg, color: st.colour, fontWeight: 600 }}>{st.label}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>{i.category}</span>
                </div>
                {i.problemStatement && <p style={{ fontSize: 12, color: "var(--text-second)", marginLeft: 18, lineHeight: 1.5 }}>{i.problemStatement}</p>}
                <div style={{ display: "flex", gap: 10, marginLeft: 18, marginTop: 4, fontSize: 11, color: "var(--text-muted)" }}>
                  {i.sourceSystem && <span>{i.sourceSystem} → {i.targetSystem}</span>}
                  {i.workatoRecipeUrl && <a href={i.workatoRecipeUrl} target="_blank" rel="noreferrer" style={{ color: "var(--purple)" }}>View recipe →</a>}
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {/* Open actions/tickets */}
      {openTickets.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader><span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>Open requests ({openTickets.length})</span></CardHeader>
          {openTickets.map((t, i) => {
            const tt = ticketType(t.type);
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: i < openTickets.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: tt.colour + "15", color: tt.colour, fontWeight: 600 }}>{tt.label}</span>
                <span style={{ fontSize: 13, flex: 1 }}>{t.description || t.jiraKey}</span>
                {t.jiraKey && <a href={`https://safetyculture.atlassian.net/browse/${t.jiraKey}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--purple)" }}>{t.jiraKey} →</a>}
              </div>
            );
          })}
        </Card>
      )}

      {/* ── Your actions ── */}
      {latestEngagement && (() => {
        // Collect customer-owned tasks. For stages not yet initialised,
        // fall back to TASK_TEMPLATES so the customer sees the full picture.
        const customerTasks = [];
        STAGE_KEYS.forEach(sk => {
          const stored = latestEngagement.stageTasks?.[sk];
          if (stored && stored.length > 0) {
            // Real tasks — use stored data (has done status, dates, etc.)
            stored
              .filter(t => t.owner === "customer" || t.ownerRole === "customer")
              .forEach(t => customerTasks.push({ ...t, stageKey: sk }));
          } else {
            // Stage not yet initialised — pull from templates so customer can see ahead
            (TASK_TEMPLATES[sk] || [])
              .filter(t => t.owner === "customer")
              .forEach(t => customerTasks.push({
                title: t.title, stageKey: sk,
                owner: "customer", ownerRole: "customer",
                customerNote: t.customerNote || null,
                done: false, startDate: null, endDate: null,
                fromTemplate: true,
              }));
          }
        });
        if (!customerTasks.length) return null;
        const pending = customerTasks.filter(t => !t.done);

        return (
          <Card style={{ marginBottom: 16 }}>
            <CardHeader>
              <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>Your actions</span>
              <span style={{ fontSize: 11, color: pending.length > 0 ? "var(--amber)" : "var(--green)", fontWeight: 600 }}>
                {pending.length > 0 ? `${pending.length} pending` : "✓ All complete"}
              </span>
            </CardHeader>
            {customerTasks.map((t, i) => {
              const stage = STAGES.find(s => s.key === t.stageKey);
              return (
                <div key={i} style={{
                  display: "flex", gap: 14, padding: "14px 18px",
                  borderBottom: i < customerTasks.length - 1 ? "1px solid var(--border)" : "none",
                  opacity: t.done ? 0.6 : 1,
                }}>
                  {/* Status dot */}
                  <div style={{ paddingTop: 2, flexShrink: 0 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: t.done ? "var(--green)" : "var(--surface2)",
                      border: `2px solid ${t.done ? "var(--green)" : "var(--border)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {t.done && <span style={{ fontSize: 9, color: "white", fontWeight: 700 }}>✓</span>}
                    </div>
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textDecoration: t.done ? "line-through" : "none" }}>
                        {t.title}
                      </p>
                      {stage && (
                        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: stage.colour + "15", color: stage.colour, fontWeight: 600 }}>
                          {stage.shortLabel}
                        </span>
                      )}
                    </div>
                    {/* Customer note — what they actually need to do */}
                    {t.customerNote && (
                      <p style={{ fontSize: 12, color: "var(--text-second)", lineHeight: 1.6 }}>
                        {t.customerNote}
                      </p>
                    )}
                    {/* Dates */}
                    {(t.startDate || t.endDate) && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                        {t.startDate && `Start: ${fmtDate(t.startDate)}`}
                        {t.startDate && t.endDate && " · "}
                        {t.endDate && `Due: ${fmtDate(t.endDate)}`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })()}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
        <Btn variant="ghost" onClick={onClose}>Close preview</Btn>
        <Btn onClick={onPublish}>
          {customer.shareEnabled ? "📋 Copy share link" : "🔗 Publish & copy link"}
        </Btn>
      </div>
    </Modal>
  );
}

// ─── Main customer dashboard ──────────────────────────────────────────────────
export default function CustomerDashboard({ customer, onBack, users, onEditCustomer, onSelectEngagement }) {
  const { user, profile } = useAuth();
  const [integrations, setIntegrations] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [showNewIntegration, setShowNewIntegration] = useState(false);
  const [editIntegration, setEditIntegration] = useState(null);
  const [deleteIntegration, setDeleteIntegration] = useState(null);
  const [showDeleteCustomer, setShowDeleteCustomer] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showShareable, setShowShareable] = useState(false);
  // Activity log
  const [activityEntries, setActivityEntries] = useState([]);
  const [activityText, setActivityText] = useState("");
  const [postingActivity, setPostingActivity] = useState(false);

  const canEdit = ["super_admin", "admin", "cse"].includes(profile?.role);
  const { toasts, toast } = useToast();

  useEffect(() => {
    if (!customer?.id) return;
    const u1 = onSnapshot(
      query(collection(db, "integrations"), where("customerId", "==", customer.id)),
      s => { setIntegrations(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }
    );
    const u2 = onSnapshot(
      query(collection(db, "engagements"), where("customerId", "==", customer.id)),
      s => setEngagements(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    // Also fetch engagements that match by csId/customer name for backwards compat
    const u3 = onSnapshot(
      query(collection(db, "engagements"), where("customer", "==", customer.name)),
      s => setEngagements(prev => {
        const existing = new Set(prev.map(e => e.id));
        const newOnes = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => !existing.has(e.id));
        return [...prev, ...newOnes];
      })
    );
    // Customer activity log
    const u4 = onSnapshot(
      query(collection(db, "customers", customer.id, "activity"), orderBy("createdAt", "desc")),
      s => setActivityEntries(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); u3(); u4(); };
  }, [customer?.id, customer?.name]);

  async function postActivity() {
    if (!activityText.trim() || !user) return;
    setPostingActivity(true);
    await addDoc(collection(db, "customers", customer.id, "activity"), {
      text: activityText.trim(),
      authorName: user.displayName,
      authorPhoto: user.photoURL,
      authorUid: user.uid,
      createdAt: serverTimestamp(),
    });
    setActivityText("");
    setPostingActivity(false);
  }

  // Ticket stats
  const allTickets = integrations.flatMap(i => (i.tickets || []).map(t => ({ ...t, integrationName: i.name })));
  const openTickets = allTickets.filter(t => t.status !== "done");
  const ticketsByType = TICKET_TYPES.reduce((acc, tt) => {
    acc[tt.key] = allTickets.filter(t => t.type === tt.key).length;
    return acc;
  }, {});

  const liveIntegrations = integrations.filter(i => i.status === "live" || i.status === "live-attention");
  const latestEngagement = engagements.sort((a, b) =>
    STAGE_KEYS.indexOf(b.currentStage) - STAGE_KEYS.indexOf(a.currentStage)
  )[0];

  async function handleDeleteIntegration() {
    if (!deleteIntegration?.id) return;
    setDeleting(true);
    await deleteDoc(doc(db, "integrations", deleteIntegration.id));
    setDeleteIntegration(null);
    setDeleting(false);
  }

  async function handleDeleteCustomer() {
    setDeleting(true);
    await deleteDoc(doc(db, "customers", customer.id));
    setDeleting(false);
    setShowDeleteCustomer(false);
    onBack();
  }

  async function handlePublish() {
    const shareUrl = `${window.location.origin}${window.location.pathname}#/share/${customer.id}`;
    if (!customer.shareEnabled) {
      await updateDoc(doc(db, "customers", customer.id), {
        shareEnabled: true, updatedAt: serverTimestamp(),
      });
    }
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    toast("Share link copied to clipboard!", "success");
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <Spinner size={28} />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      {/* Back + header */}
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 5, padding: 0, fontFamily: "inherit" }}>
        ← All customers
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "var(--radius-lg)", background: "var(--purple-light)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 18, color: "var(--purple)",
          }}>
            {customer.name?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22 }}>{customer.name}</h1>
              <Pill color="grey" style={{ fontSize: 11 }}>{customer.segment}</Pill>
              <Pill color="grey" style={{ fontSize: 11 }}>{customer.region}</Pill>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {[customer.subscription, customer.industry, customer.arr && `ARR: £${Number(customer.arr).toLocaleString()}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="ghost" onClick={() => setShowShareable(true)}>👁 Preview shareable view</Btn>
          {canEdit && onEditCustomer && (
            <Btn variant="ghost" onClick={() => onEditCustomer(customer)}>✎ Edit customer</Btn>
          )}
          {canEdit && (
            <Btn
              variant="ghost"
              onClick={() => setShowDeleteCustomer(true)}
              style={{ color: "var(--red)", borderColor: "var(--red)" }}
            >
              Delete
            </Btn>
          )}
          {canEdit && <Btn onClick={() => setShowNewIntegration(true)}>+ New integration</Btn>}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total integrations", value: integrations.length, colour: "var(--purple)" },
          { label: "Live", value: liveIntegrations.length, colour: "var(--green)" },
          { label: "Open tickets", value: openTickets.length, colour: openTickets.length > 0 ? "var(--amber)" : "var(--text-muted)" },
          { label: "Engagements", value: engagements.length, colour: "var(--blue)" },
          { label: "Change requests", value: ticketsByType["enhancement"] + ticketsByType["config-change"] || 0, colour: "#8B5CF6" },
        ].map(s => (
          <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px", boxShadow: "var(--shadow-sm)" }}>
            <Label style={{ marginBottom: 6, display: "block" }}>{s.label}</Label>
            <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 24, color: s.colour }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs tabs={[
        { id: "overview",     label: "Overview" },
        { id: "integrations", label: "Integrations", badge: integrations.length || null },
        { id: "tickets",      label: "Request history", badge: openTickets.length || null },
        { id: "engagements",  label: "Engagements", badge: engagements.length || null },
        { id: "activity",     label: "Activity log" },
      ]} active={tab} onChange={setTab} style={{ marginBottom: 18 }} />

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Account info */}
          <Card>
            <CardHeader><Label>Account details</Label></CardHeader>
            <div style={{ padding: "14px 18px" }}>
              {[
                ["SF Account ID", customer.sfAccountId],
                ["Region", customer.region],
                ["Segment", customer.segment],
                ["Subscription", customer.subscription],
                ["ARR", customer.arr ? `£${Number(customer.arr).toLocaleString()}` : null],
                ["Industry", customer.industry],
                ["Employees", customer.employees],
                ["Website", customer.website],
              ].filter(([,v]) => v).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Team */}
          <Card>
            <CardHeader><Label>Account team</Label></CardHeader>
            <div style={{ padding: "14px 18px" }}>
              {[
                ["CSM", customer.csmName],
                ["COM", customer.comName],
                ["AE", customer.aeName],
              ].filter(([,v]) => v).map(([role, name]) => (
                <div key={role} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <Avatar name={name} size={28} />
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 500 }}>{name}</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{role}</p>
                  </div>
                </div>
              ))}
              {customer.scOrgRoleId && (
                <div style={{ marginTop: 12, padding: "8px 10px", background: "var(--surface2)", borderRadius: "var(--radius-sm)", fontSize: 11, color: "var(--text-muted)" }}>
                  SC Org Role ID: <span style={{ fontFamily: "monospace", color: "var(--text-primary)" }}>{customer.scOrgRoleId}</span>
                </div>
              )}
              {customer.periscopeLink && (
                <a href={customer.periscopeLink} target="_blank" rel="noreferrer"
                  style={{ display: "block", marginTop: 8, fontSize: 12, color: "var(--purple)" }}>
                  View in Periscope →
                </a>
              )}
            </div>
          </Card>

          {/* Integration summary */}
          {integrations.length > 0 && (
            <Card style={{ gridColumn: "1 / -1" }}>
              <CardHeader>
                <Label>Integration portfolio</Label>
                {canEdit && <Btn size="sm" variant="ghost" onClick={() => setShowNewIntegration(true)}>+ Add</Btn>}
              </CardHeader>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, padding: 14 }}>
                {integrations.map(i => {
                  const st = integrationStatus(i.status);
                  const openCount = (i.tickets || []).filter(t => t.status !== "done").length;
                  return (
                    <div key={i.id} onClick={() => setEditIntegration(i)} style={{
                      padding: "12px 14px", background: "var(--surface2)",
                      border: `1px solid ${st.colour}30`, borderRadius: "var(--radius)",
                      cursor: "pointer", transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
                    onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: st.colour, flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{i.name}</span>
                      </div>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{i.category}</p>
                      <div style={{ display: "flex", gap: 6 }}>
                        <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: st.bg, color: st.colour, fontWeight: 600 }}>{st.label}</span>
                        {openCount > 0 && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "var(--amber-light)", color: "var(--amber)", fontWeight: 600 }}>{openCount} open</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Latest engagement */}
          {latestEngagement && (
            <Card style={{ gridColumn: integrations.length > 0 ? "1 / -1" : "auto" }}>
              <CardHeader>
                <Label>Latest engagement</Label>
                <Pill color="grey" style={{ fontSize: 10 }}>{latestEngagement.currentStage?.replace("-", " ")}</Pill>
              </CardHeader>
              <div style={{ padding: 14 }}>
                <div style={{ display: "flex", marginBottom: 8 }}>
                  {STAGES.map((s, i) => {
                    const isCurrent = s.key === latestEngagement.currentStage;
                    const isPast = STAGE_KEYS.indexOf(s.key) < STAGE_KEYS.indexOf(latestEngagement.currentStage);
                    return (
                      <div key={s.key} style={{ flex: 1, textAlign: "center", fontSize: 9, color: isCurrent ? s.colour : isPast ? "var(--text-muted)" : "var(--border)" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {i > 0 && <div style={{ flex: 1, height: 2, background: isPast ? s.colour + "60" : "var(--border)" }} />}
                          <span style={{ fontSize: 13 }}>{s.icon}</span>
                          {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: "var(--border)" }} />}
                        </div>
                        <p style={{ marginTop: 3, fontWeight: isCurrent ? 700 : 400 }}>{s.shortLabel}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── INTEGRATIONS ── */}
      {tab === "integrations" && (
        <div>
          {integrations.length === 0 ? (
            <EmptyState icon="⚙️" title="No integrations yet"
              description="Log the first integration for this customer"
              action={canEdit && <Btn onClick={() => setShowNewIntegration(true)}>+ New integration</Btn>} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {integrations.map(i => {
                const st = integrationStatus(i.status);
                const openT = (i.tickets || []).filter(t => t.status !== "done").length;
                const latestVersion = (i.versionHistory || []).slice(-1)[0];
                return (
                  <Card key={i.id}>
                    <div style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                            <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 15 }}>{i.name}</h3>
                            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: st.bg, color: st.colour, fontWeight: 600 }}>{st.label}</span>
                            <Pill color="grey" style={{ fontSize: 10 }}>{i.category}</Pill>
                          </div>
                          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {[i.sourceSystem && `${i.sourceSystem} → ${i.targetSystem}`, i.dataDirection, i.cseBuiltBy && `Built by ${i.cseBuiltBy}`].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <Btn size="sm" variant="ghost" onClick={() => setEditIntegration(i)}>View / Edit</Btn>
                        {canEdit && (
                          <button
                            onClick={() => setDeleteIntegration(i)}
                            style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, padding: "4px 10px", fontFamily: "inherit", transition: "all 0.13s" }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                          >Delete</button>
                        )}
                      </div>

                      {i.problemStatement && (
                        <p style={{ fontSize: 13, color: "var(--text-second)", lineHeight: 1.6, marginBottom: 10 }}>{i.problemStatement}</p>
                      )}

                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
                        {i.workatoRecipeUrl && <a href={i.workatoRecipeUrl} target="_blank" rel="noreferrer" style={{ color: "var(--purple)" }}>View Workato recipe →</a>}
                        {latestVersion && <span>v{latestVersion.version} — {latestVersion.description}</span>}
                        {openT > 0 && <span style={{ color: "var(--amber)" }}>⚠ {openT} open ticket{openT !== 1 ? "s" : ""}</span>}
                      </div>

                      {/* Tickets summary */}
                      {(i.tickets || []).length > 0 && (
                        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                          {TICKET_TYPES.map(tt => {
                            const count = (i.tickets || []).filter(t => t.type === tt.key).length;
                            if (!count) return null;
                            return <span key={tt.key} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: tt.colour + "12", color: tt.colour, fontWeight: 600 }}>{tt.label}: {count}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TICKETS ── */}
      {tab === "tickets" && (
        <div>
          {/* Summary by type */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {TICKET_TYPES.map(tt => {
              const count = ticketsByType[tt.key] || 0;
              const open = allTickets.filter(t => t.type === tt.key && t.status !== "done").length;
              return (
                <div key={tt.key} style={{
                  padding: "10px 14px", background: "var(--surface)", border: `1px solid ${tt.colour}25`,
                  borderRadius: "var(--radius)", minWidth: 100, textAlign: "center",
                }}>
                  <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, color: tt.colour }}>{count}</p>
                  <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{tt.label}</p>
                  {open > 0 && <p style={{ fontSize: 10, color: "var(--amber)", marginTop: 2 }}>{open} open</p>}
                </div>
              );
            })}
          </div>

          {/* All tickets grouped by integration */}
          {integrations.filter(i => (i.tickets || []).length > 0).map(i => (
            <Card key={i.id} style={{ marginBottom: 10 }}>
              <CardHeader>
                <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>{i.name}</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{(i.tickets || []).length} ticket{(i.tickets||[]).length !== 1 ? "s" : ""}</span>
              </CardHeader>
              <div style={{ display: "grid", gridTemplateColumns: "110px 110px 1fr 100px", gap: 8, padding: "7px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                {["Type", "Jira key", "Description", "Status"].map(h => <Label key={h}>{h}</Label>)}
              </div>
              {(i.tickets || []).map((t, idx) => {
                const tt = ticketType(t.type);
                return (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "110px 110px 1fr 100px", gap: 8, padding: "10px 16px", borderBottom: idx < (i.tickets||[]).length - 1 ? "1px solid var(--border)" : "none", alignItems: "center" }}>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: tt.colour + "12", color: tt.colour, fontWeight: 600, display: "inline-block" }}>{tt.label}</span>
                    {t.jiraKey ? (
                      <a href={`https://safetyculture.atlassian.net/browse/${t.jiraKey}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--purple)", fontFamily: "monospace" }}>{t.jiraKey}</a>
                    ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>}
                    <span style={{ fontSize: 13 }}>{t.description || "—"}</span>
                    <span style={{
                      fontSize: 11, padding: "2px 8px", borderRadius: 999, fontWeight: 600,
                      background: t.status === "done" ? "var(--green-light)" : t.status === "in-progress" ? "var(--blue-light)" : "var(--surface2)",
                      color: t.status === "done" ? "var(--green)" : t.status === "in-progress" ? "var(--blue)" : "var(--text-muted)",
                      display: "inline-block",
                    }}>
                      {t.status || "open"}
                    </span>
                  </div>
                );
              })}
            </Card>
          ))}

          {allTickets.length === 0 && (
            <EmptyState icon="🎫" title="No tickets yet" description="Tickets are logged against integrations" />
          )}
        </div>
      )}

      {/* ── ENGAGEMENTS ── */}
      {tab === "engagements" && (
        <div>
          {engagements.length === 0 ? (
            <EmptyState icon="🗂️" title="No engagements linked" description="Engagements appear here when linked to this customer" />
          ) : (
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 70px 60px", gap: 10, padding: "8px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                {["Engagement", "Stage", "RAG", "ARR", ""].map(h => <Label key={h}>{h}</Label>)}
              </div>
              {engagements.map((e, i) => {
                const stage = STAGES.find(s => s.key === e.currentStage);
                const rag = RAG_STATUSES.find(r => r.key === e.ragStatus) || RAG_STATUSES[0];
                return (
                  <div key={e.id}
                    onClick={() => onSelectEngagement?.(e)}
                    style={{
                      display: "grid", gridTemplateColumns: "1fr 120px 80px 70px 60px",
                      gap: 10, padding: "11px 18px",
                      borderBottom: i < engagements.length - 1 ? "1px solid var(--border)" : "none",
                      alignItems: "center",
                      cursor: onSelectEngagement ? "pointer" : "default",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e2 => { if (onSelectEngagement) e2.currentTarget.style.background = "var(--purple-light)"; }}
                    onMouseLeave={e2 => { e2.currentTarget.style.background = "transparent"; }}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{e.csId || e.jiraKey || e.customer || "—"}</p>
                      {e.notes && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{e.notes?.slice(0, 80)}{e.notes?.length > 80 ? "…" : ""}</p>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 13 }}>{stage?.icon}</span>
                      <span style={{ fontSize: 11, color: stage?.colour, fontWeight: 600 }}>{stage?.label || stage?.shortLabel}</span>
                    </div>
                    <Pill color={rag.key === "green" ? "green" : rag.key === "red" ? "red" : "amber"} style={{ fontSize: 10 }}>{rag.emoji} {rag.label}</Pill>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{e.arr ? `£${Number(e.arr).toLocaleString()}` : "—"}</span>
                    {onSelectEngagement && (
                      <span style={{ fontSize: 11, color: "var(--purple)", fontWeight: 600 }}>Open →</span>
                    )}
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      )}

      {/* ── ACTIVITY LOG ── */}
      {tab === "activity" && (
        <div>
          {/* New entry composer */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ padding: "14px 18px" }}>
              <Label style={{ marginBottom: 8, display: "block" }}>Add note</Label>
              <Textarea
                value={activityText}
                onChange={e => setActivityText(e.target.value)}
                placeholder="Account notes, relationship context, renewal signals, product feedback, exec conversations..."
                rows={3}
                style={{ marginBottom: 10 }}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) postActivity(); }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Btn onClick={postActivity} disabled={!activityText.trim() || postingActivity} size="sm">
                  {postingActivity ? "Posting..." : "Add note"}
                </Btn>
              </div>
            </div>
          </Card>

          {/* Entry list */}
          {activityEntries.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>📝</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>No notes yet</p>
              <p style={{ fontSize: 13 }}>Use this log for account notes, renewal signals, exec conversations, and anything that doesn't belong on a specific task.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activityEntries.map(entry => {
                const ts = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt || 0);
                return (
                  <Card key={entry.id} style={{ padding: "14px 18px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      {/* Avatar */}
                      <div style={{
                        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                        background: "var(--purple-light)", display: "flex", alignItems: "center",
                        justifyContent: "center", overflow: "hidden",
                      }}>
                        {entry.authorPhoto
                          ? <img src={entry.authorPhoto} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                          : <span style={{ fontSize: 11, fontWeight: 700, color: "var(--purple)" }}>
                              {entry.authorName?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                            </span>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{entry.authorName}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {ts.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            {" · "}
                            {ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p style={{ fontSize: 13, color: "var(--text-second)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{entry.text}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Integration modals */}
      {showNewIntegration && (
        <IntegrationModal
          open={showNewIntegration}
          onClose={() => setShowNewIntegration(false)}
          customerId={customer.id}
          customerName={customer.name}
          users={users}
        />
      )}
      {editIntegration && (
        <IntegrationModal
          open={!!editIntegration}
          onClose={() => setEditIntegration(null)}
          customerId={customer.id}
          customerName={customer.name}
          initial={editIntegration}
          users={users}
        />
      )}

      {/* Shareable view preview */}
      {showShareable && (
        <ShareableView
          customer={customer}
          integrations={integrations}
          engagements={engagements}
          onClose={() => setShowShareable(false)}
          onPublish={handlePublish}
        />
      )}

      {/* Delete integration confirm */}
      <Modal open={!!deleteIntegration} onClose={() => setDeleteIntegration(null)} title="Delete integration" width={420}>
        <p style={{ fontSize: 13, color: "var(--text-second)", marginBottom: 8 }}>
          Are you sure you want to delete <strong>{deleteIntegration?.name}</strong>?
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
          All scoping, design, operational details, tickets and version history will be permanently removed.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setDeleteIntegration(null)}>Cancel</Btn>
          <Btn onClick={handleDeleteIntegration} disabled={deleting} style={{ background: "var(--red)", color: "white" }}>
            {deleting ? "Deleting..." : "Delete integration"}
          </Btn>
        </div>
      </Modal>

      {/* Delete customer confirm */}
      <Modal open={showDeleteCustomer} onClose={() => setShowDeleteCustomer(false)} title="Delete customer" width={420}>
        <p style={{ fontSize: 13, color: "var(--text-second)", marginBottom: 8 }}>
          Are you sure you want to delete <strong>{customer.name}</strong>?
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
          This removes the customer record only. Linked engagements and integrations will not be deleted but will lose their customer association.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowDeleteCustomer(false)}>Cancel</Btn>
          <Btn onClick={handleDeleteCustomer} disabled={deleting} style={{ background: "var(--red)", color: "white" }}>
            {deleting ? "Deleting..." : "Delete customer"}
          </Btn>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} />
    </div>
  );
}

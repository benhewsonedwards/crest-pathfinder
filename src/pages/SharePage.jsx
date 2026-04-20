import { useState, useEffect, useRef } from "react";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { STAGES, STAGE_KEYS, RAG_STATUSES, TASK_TEMPLATES, stageColour, fmtDate } from "../lib/constants";
import { integrationStatus, TICKET_TYPES, ticketType } from "../lib/integrationConstants";
import { loadShareLinkByToken } from "../lib/shareLinks";
import { personByEmail } from "../lib/people";
import { Spinner } from "../components/UI";

const LABEL_W = 140;

// ─── Mini Gantt ───────────────────────────────────────────────────────────────
function MiniGantt({ stageTasks }) {
  const allTasks = [];
  STAGE_KEYS.forEach(sk => (stageTasks?.[sk] || []).forEach(t => allTasks.push({ ...t, stageKey: sk })));
  const dated = allTasks.filter(t => t.startDate || t.endDate);
  if (!dated.length) return null;
  const allDates = dated.flatMap(t => [t.startDate, t.endDate]).filter(Boolean).sort();
  const minDate = new Date(allDates[0]); minDate.setDate(minDate.getDate() - 1);
  const maxDate = new Date(allDates[allDates.length - 1]); maxDate.setDate(maxDate.getDate() + 2);
  const span = maxDate - minDate;
  const xPct = iso => ((new Date(iso) - minDate) / span) * 100;
  const todayPct = xPct(new Date().toISOString().slice(0, 10));
  const showToday = todayPct > 0 && todayPct < 100;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ minWidth: 420 }}>
        {dated.map((t, i) => {
          const colour = stageColour(t.stageKey);
          const isOverdue = !t.done && t.endDate && t.endDate < today;
          const barColour = t.done ? "#16A34A" : isOverdue ? "#EF4444" : colour;
          const x1 = xPct(t.startDate || t.endDate);
          const x2 = xPct(t.endDate || t.startDate);
          const w = Math.max(x2 - x1, 1.5);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: "#6B7280", width: LABEL_W, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{t.title}</span>
              <div style={{ flex: 1, position: "relative", height: 16, background: "#F3F4F6", borderRadius: 4 }}>
                {showToday && <div style={{ position: "absolute", top: 0, bottom: 0, left: `${todayPct}%`, width: 1.5, background: "#D97706", zIndex: 2, opacity: 0.85 }} />}
                <div style={{ position: "absolute", left: `${x1}%`, width: `${w}%`, height: "100%", background: barColour + (t.done ? "50" : "80"), borderRadius: 4, borderLeft: `2px solid ${barColour}` }} />
              </div>
            </div>
          );
        })}
        {showToday && (
          <div style={{ display: "flex", marginTop: 1 }}>
            <div style={{ width: LABEL_W, flexShrink: 0 }} />
            <div style={{ flex: 1, position: "relative" }}>
              <span style={{ position: "absolute", left: `${todayPct}%`, transform: "translateX(-50%)", fontSize: 8, color: "#D97706", fontWeight: 700 }}>TODAY</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const st = integrationStatus(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 999, background: st.bg, color: st.colour, fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.colour }} />
      {st.label}
    </span>
  );
}

// ─── Customer Task Row ────────────────────────────────────────────────────────
function CustomerTaskRow({ task, stageKey, engagementId, taskIndex, onUpdate }) {
  const [expanded, setExpanded]   = useState(false);
  const [note, setNote]           = useState("");
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef();
  const stage = STAGES.find(s => s.key === stageKey);
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = !task.done && task.endDate && task.endDate < today;

  async function markDone() {
    setSaving(true);
    const updates = { done: true, doneAt: new Date().toISOString() };
    await onUpdate(taskIndex, stageKey, updates);
    setSaving(false);
  }

  async function submitNote() {
    if (!note.trim()) return;
    setSaving(true);
    const entry = { text: note.trim(), at: new Date().toISOString() };
    const updatedNotes = [...(task.customerNotes || []), entry];
    await onUpdate(taskIndex, stageKey, { customerNotes: updatedNotes });
    setNote("");
    setSaving(false);
    setExpanded(false);
  }

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    // Firebase Storage requires Blaze plan — placeholder until upgraded
    alert("File uploads require Firebase Storage (Blaze plan). This feature is not yet active.");
    e.target.value = "";
  }

  return (
    <div style={{
      padding: "14px 20px",
      borderBottom: "1px solid #F3F4F6",
      opacity: task.done ? 0.6 : 1,
      background: isOverdue ? "#FEF2F2" : "transparent",
    }}>
      <div style={{ display: "flex", gap: 14 }}>
        {/* Checkbox / done indicator */}
        <div style={{ paddingTop: 2, flexShrink: 0 }}>
          {task.done ? (
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#16A34A", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 11, color: "white", fontWeight: 700 }}>✓</span>
            </div>
          ) : (
            <button
              onClick={markDone}
              disabled={saving}
              title="Mark as complete"
              style={{
                width: 22, height: 22, borderRadius: "50%",
                background: "white", border: `2px solid ${isOverdue ? "#EF4444" : "#D1D5DB"}`,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#F0FDF4"; e.currentTarget.style.borderColor = "#16A34A"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = isOverdue ? "#EF4444" : "#D1D5DB"; }}
            >
              {saving ? <span style={{ fontSize: 8, color: "#9CA3AF" }}>...</span> : null}
            </button>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", textDecoration: task.done ? "line-through" : "none", margin: 0 }}>{task.title}</p>
            {stage && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: stage.colour + "18", color: stage.colour, fontWeight: 600 }}>{stage.shortLabel}</span>}
            {isOverdue && !task.done && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: "#FEE2E2", color: "#DC2626", fontWeight: 600 }}>Overdue</span>}
          </div>

          {task.customerNote && <p style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.65, margin: "0 0 6px" }}>{task.customerNote}</p>}

          {(task.startDate || task.endDate) && (
            <p style={{ fontSize: 11, color: "#9CA3AF", margin: "0 0 8px" }}>
              {task.startDate && `Start: ${fmtDate(task.startDate)}`}
              {task.startDate && task.endDate && " · "}
              {task.endDate && `Due: ${fmtDate(task.endDate)}`}
            </p>
          )}

          {/* Previous notes */}
          {(task.customerNotes || []).map((n, i) => (
            <div key={i} style={{ fontSize: 12, color: "#4B5563", background: "#F9FAFB", borderLeft: "3px solid #6559FF", padding: "6px 10px", borderRadius: "0 6px 6px 0", marginBottom: 6 }}>
              <p style={{ margin: 0 }}>{n.text}</p>
              <p style={{ fontSize: 10, color: "#9CA3AF", margin: "3px 0 0" }}>{new Date(n.at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          ))}

          {/* Uploaded files */}
          {(task.customerFiles || []).map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#6559FF", marginBottom: 4 }}>
              <span>📎</span>
              <a href={f.url} target="_blank" rel="noreferrer" style={{ color: "#6559FF" }}>{f.name}</a>
            </div>
          ))}

          {/* Action buttons (only for incomplete tasks) */}
          {!task.done && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => setExpanded(e => !e)}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "white", cursor: "pointer", color: "#374151" }}
              >
                {expanded ? "Cancel" : "💬 Add note"}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "white", cursor: "pointer", color: "#374151" }}
              >
                📎 Upload file
              </button>
              <input ref={fileRef} type="file" style={{ display: "none" }} onChange={handleFileChange} />
            </div>
          )}

          {/* Note input */}
          {expanded && !task.done && (
            <div style={{ marginTop: 10 }}>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Add an update or comment..."
                rows={3}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 12, fontFamily: "inherit", resize: "vertical", outline: "none" }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button
                  onClick={submitNote}
                  disabled={!note.trim() || saving}
                  style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", background: "#6559FF", color: "white", cursor: "pointer", fontWeight: 600, opacity: !note.trim() ? 0.5 : 1 }}
                >
                  {saving ? "Saving..." : "Submit"}
                </button>
                <button onClick={() => { setExpanded(false); setNote(""); }} style={{ fontSize: 12, padding: "5px 10px", borderRadius: 6, border: "1px solid #E5E7EB", background: "white", cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SharePage({ token, customerId: legacyCustomerId }) {
  const [customer, setCustomer]     = useState(null);
  const [integrations, setInts]     = useState([]);
  const [engagements, setEngs]      = useState([]);
  const [loading, setLoading]       = useState(true);
  const [notFound, setNotFound]     = useState(false);
  const [engagementId, setEngId]    = useState(null);

  useEffect(() => {
    (async () => {
      try {
        let customerId;

        if (token) {
          // Token-based (new) — load via shareLinks collection
          const link = await loadShareLinkByToken(token);
          if (!link) { setNotFound(true); setLoading(false); return; }
          customerId = link.customerId;
          setEngId(link.engagementId);
        } else if (legacyCustomerId) {
          // Legacy direct customerId route (backwards compat)
          customerId = legacyCustomerId;
        } else {
          setNotFound(true); setLoading(false); return;
        }

        const snap = await getDoc(doc(db, "customers", customerId));
        if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
        const cust = { id: snap.id, ...snap.data() };
        // Legacy route requires shareEnabled; token route is always accessible
        if (!token && !cust.shareEnabled) { setNotFound(true); setLoading(false); return; }
        setCustomer(cust);

        const iSnap = await getDocs(query(collection(db, "integrations"), where("customerId", "==", customerId)));
        setInts(iSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const eSnap = await getDocs(query(collection(db, "engagements"), where("customerId", "==", customerId)));
        const eSnap2 = await getDocs(query(collection(db, "engagements"), where("customer", "==", cust.name)));
        const allEngs = [...eSnap.docs, ...eSnap2.docs.filter(d => !eSnap.docs.find(e => e.id === d.id))]
          .map(d => ({ id: d.id, ...d.data() }));
        setEngs(allEngs);
      } catch (e) {
        console.error(e);
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [token, legacyCustomerId]);

  async function updateTask(taskIdx, stageKey, updates) {
    if (!engagements.length) return;
    const eng = engagementId
      ? engagements.find(e => e.id === engagementId) || engagements[0]
      : engagements[0];
    if (!eng) return;
    const tasks = [...(eng.stageTasks?.[stageKey] || [])];
    tasks[taskIdx] = { ...tasks[taskIdx], ...updates };
    await updateDoc(doc(db, "engagements", eng.id), { [`stageTasks.${stageKey}`]: tasks });
    // Update local state
    setEngs(prev => prev.map(e => e.id === eng.id
      ? { ...e, stageTasks: { ...e.stageTasks, [stageKey]: tasks } }
      : e
    ));
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F7FB" }}>
      <div style={{ textAlign: "center" }}><Spinner size={28} /><p style={{ marginTop: 12, fontSize: 13, color: "#9CA3AF" }}>Loading...</p></div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F7FB" }}>
      <div style={{ textAlign: "center", maxWidth: 400, padding: 32 }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🔒</p>
        <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 20, color: "#111827", marginBottom: 8 }}>This page isn't available</h1>
        <p style={{ fontSize: 14, color: "#6B7280" }}>This link may have been deactivated or doesn't exist. Contact your SafetyCulture team for a new link.</p>
      </div>
    </div>
  );

  const latestEngagement = engagementId
    ? engagements.find(e => e.id === engagementId) || engagements[0]
    : engagements.sort((a, b) => STAGE_KEYS.indexOf(b.currentStage) - STAGE_KEYS.indexOf(a.currentStage))[0];

  const allTickets = integrations.flatMap(i => (i.tickets || []).map(t => ({ ...t, integrationName: i.name })));
  const openTickets = allTickets.filter(t => t.status !== "done");
  const liveInts = integrations.filter(i => i.status === "live" || i.status === "live-attention");

  // Resolve CSM/COM/AE names from email
  const csmPerson = customer.csmEmail ? personByEmail(customer.csmEmail) : null;
  const comPerson = customer.comEmail ? personByEmail(customer.comEmail) : null;
  const aePerson  = customer.aeEmail  ? personByEmail(customer.aeEmail)  : null;
  const teamMembers = [
    csmPerson && ["Customer Success Manager", csmPerson.name],
    comPerson && ["Customer Onboarding Manager", comPerson.name],
    aePerson  && ["Account Executive", aePerson.name],
    !csmPerson && customer.csmName && ["Customer Success Manager", customer.csmName],
    !comPerson && customer.comName && ["Customer Onboarding Manager", customer.comName],
    !aePerson  && customer.aeName  && ["Account Executive", customer.aeName],
  ].filter(Boolean);

  const S = {
    card: { background: "#FFFFFF", border: "1px solid #E4E7EF", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
    cardHead: { padding: "12px 20px", borderBottom: "1px solid #E4E7EF", background: "#F8F9FC", display: "flex", alignItems: "center", justifyContent: "space-between" },
    label: { fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9CA3AF" },
  };

  // Get customer tasks from the latest engagement
  const customerTasks = [];
  if (latestEngagement) {
    STAGE_KEYS.forEach(sk => {
      const stored = latestEngagement.stageTasks?.[sk];
      if (stored && stored.length > 0) {
        stored.forEach((t, realIdx) => {
          if (t.owner === "customer" || t.ownerRole === "customer" || t.ownerEmail === "customer") {
            customerTasks.push({ task: t, stageKey: sk, taskIndex: realIdx });
          }
        });
      } else {
        (TASK_TEMPLATES[sk] || [])
          .filter(t => t.owner === "customer")
          .forEach(t => customerTasks.push({
            task: { title: t.title, owner: "customer", ownerRole: "customer", customerNote: t.customerNote || null, done: false, startDate: null, endDate: null },
            stageKey: sk,
            taskIndex: -1,
          }));
      }
    });
  }

  const pending = customerTasks.filter(({ task }) => !task.done);

  // Overall engagement task completion (all tasks, not just customer ones)
  const allEngagementTasks = latestEngagement
    ? STAGE_KEYS.flatMap(sk => latestEngagement.stageTasks?.[sk] || [])
    : [];
  const completedCount = allEngagementTasks.filter(t => t.done).length;
  const totalCount = allEngagementTasks.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7FB", fontFamily: "'Noto Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Noto+Sans:wght@400;500;600&display=swap');`}</style>

      {/* Header */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E4E7EF", padding: "16px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #6559FF, #8B80FF)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L4 6.5V11C4 15.1 7 18.9 11 20C15 18.9 18 15.1 18 11V6.5L11 2Z" fill="white" fillOpacity="0.9"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>SafetyCulture · CREST Pathfinder</p>
          <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 17, color: "#111827", margin: 0 }}>{customer.name}</h1>
        </div>
        {pending.length > 0 && (
          <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#92400E", fontWeight: 600 }}>
            {pending.length} action{pending.length !== 1 ? "s" : ""} pending
          </div>
        )}
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 20px 48px" }}>

        {/* Overall progress banner */}
        {totalCount > 0 && (
          <div style={{ background: "#FFFFFF", border: "1px solid #E4E7EF", borderRadius: 12, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827", margin: 0 }}>
                  Engagement progress
                </p>
                <span style={{ fontSize: 13, fontWeight: 700, color: completionPct === 100 ? "#16A34A" : "#6559FF" }}>
                  {completionPct}%
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "#E5E7EB", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${completionPct}%`, borderRadius: 999, background: completionPct === 100 ? "#16A34A" : "#6559FF", transition: "width 0.4s ease" }} />
              </div>
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6, margin: "6px 0 0" }}>
                {completedCount} of {totalCount} tasks complete
                {pending.length > 0 && <span style={{ color: "#D97706", fontWeight: 600 }}> · {pending.length} action{pending.length !== 1 ? "s" : ""} need your input</span>}
              </p>
            </div>
          </div>
        )}

        {/* Progress */}
        {latestEngagement && (
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827" }}>Engagement progress</span>
              {(() => {
                const stage = STAGES.find(s => s.key === latestEngagement.currentStage);
                return stage && <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 999, background: stage.colour + "18", color: stage.colour, fontWeight: 600 }}>{stage.label}</span>;
              })()}
            </div>
            <div style={{ padding: "16px 20px" }}>
              <div style={{ display: "flex", gap: 0, marginBottom: 16, borderRadius: 8, overflow: "hidden" }}>
                {STAGE_KEYS.map(sk => {
                  const stage = STAGES.find(s => s.key === sk);
                  const isCurrent = sk === latestEngagement.currentStage;
                  const isPast = STAGE_KEYS.indexOf(sk) < STAGE_KEYS.indexOf(latestEngagement.currentStage);
                  return (
                    <div key={sk} style={{ flex: 1, height: 8, background: isPast ? stage?.colour : isCurrent ? stage?.colour + "AA" : "#E5E7EB" }} />
                  );
                })}
              </div>
              <MiniGantt stageTasks={latestEngagement.stageTasks} />
            </div>
          </div>
        )}

        {/* Your actions */}
        {customerTasks.length > 0 && (
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827" }}>Your actions</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: pending.length > 0 ? "#D97706" : "#16A34A" }}>
                {pending.length > 0 ? `${pending.length} pending` : "✓ All complete"}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "#6B7280", padding: "10px 20px 0", margin: 0, lineHeight: 1.5 }}>
              These are tasks that require your input. Click the circle to mark complete, add a note, or upload a file.
            </p>
            {customerTasks.map(({ task, stageKey, taskIndex }, i) => (
              <CustomerTaskRow
                key={i}
                task={task}
                stageKey={stageKey}
                taskIndex={taskIndex}
                engagementId={latestEngagement?.id}
                onUpdate={taskIndex >= 0 ? updateTask : async () => {}}
              />
            ))}
          </div>
        )}

        {/* Live integrations */}
        {liveInts.length > 0 && (
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827" }}>Live integrations ({liveInts.length})</span>
            </div>
            {liveInts.map((integ, i) => (
              <div key={i} style={{ padding: "14px 20px", borderBottom: i < liveInts.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{integ.name}</span>
                  <StatusBadge status={integ.status} />
                  <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>{integ.category}</span>
                </div>
                {integ.problemStatement && <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6, marginBottom: 6 }}>{integ.problemStatement}</p>}
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6B7280" }}>
                  {integ.sourceSystem && <span>{integ.sourceSystem} → {integ.targetSystem}</span>}
                  {integ.dataDirection && <span>{integ.dataDirection}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Open requests */}
        {openTickets.length > 0 && (
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827" }}>Open requests ({openTickets.length})</span>
            </div>
            {openTickets.map((t, i) => {
              const tt = ticketType(t.type);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: i < openTickets.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: tt.colour + "15", color: tt.colour, fontWeight: 600 }}>{tt.label}</span>
                  <span style={{ fontSize: 13, flex: 1, color: "#111827" }}>{t.description || "—"}</span>
                  {t.jiraKey && <a href={`https://safetyculture.atlassian.net/browse/${t.jiraKey}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#6559FF", fontWeight: 600 }}>{t.jiraKey} →</a>}
                </div>
              );
            })}
          </div>
        )}

        {/* Your team */}
        {teamMembers.length > 0 && (
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827" }}>Your SafetyCulture team</span>
            </div>
            <div style={{ padding: "14px 20px", display: "flex", gap: 20, flexWrap: "wrap" }}>
              {teamMembers.map(([role, name]) => (
                <div key={role}>
                  <p style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{role}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 24 }}>
          This view is confidential and intended for {customer.name} only · Powered by CREST Pathfinder · SafetyCulture
        </p>
      </div>
    </div>
  );
}

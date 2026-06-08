import { useState, useEffect, useRef } from "react";
import {
  collection, onSnapshot, addDoc, updateDoc, doc,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { Btn, Pill, Avatar, Label, Textarea, Select, Input, useToast, ToastContainer } from "../components/UI";
import { calcScore, DEFAULT_ARR_CEILING } from "../lib/acRanking";

// ─── Milestone config ─────────────────────────────────────────────────────────

const MILESTONE_TYPES = [
  "Request opened", "Kick off meeting", "Discovery complete",
  "POC presented", "Solution approved", "Build started",
  "Testing", "Handover call", "Go live", "Deadline",
  "Customer update", "Internal update", "Blocker raised",
  "Blocker resolved", "Meeting scheduled", "Reassigned", "Closed",
];

const MILESTONE_ICONS = {
  "Request opened": "📥", "Kick off meeting": "🤝", "Discovery complete": "🔍",
  "POC presented": "💡", "Solution approved": "✅", "Build started": "🔨",
  "Testing": "🧪", "Handover call": "📞", "Go live": "🚀", "Deadline": "📅",
  "Customer update": "💬", "Internal update": "📝", "Blocker raised": "🚧",
  "Blocker resolved": "✔", "Meeting scheduled": "📆", "Reassigned": "🔄",
  "Closed": "🔒",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtShortDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtARR(n) {
  if (!n) return "—";
  if (n >= 1000000) return `£${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `£${(n / 1000).toFixed(0)}k`;
  return `£${n}`;
}

function toInputDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toISOString().split("T")[0];
}

function fromInputDate(s) {
  if (!s) return null;
  return Timestamp.fromDate(new Date(s));
}

function fmtAge(ts) {
  if (!ts) return "—";
  const days = Math.floor((Date.now() - (ts.toDate ? ts.toDate() : new Date(ts))) / 86400000);
  if (days === 0) return "Today";
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

const PRIORITY_COLOURS = { Critical: "red", High: "orange", Medium: "amber", Low: "grey" };
const STATUS_COLOURS = {
  "In Progress": "blue", "Scoping": "purple", "In Review": "teal",
  "Waiting on Customer": "grey", "Unplanned": "grey", "On Hold": "amber", "Closed": "green",
};

// ─── Horizontal timeline ──────────────────────────────────────────────────────

function MilestoneTimeline({ milestones, onToggle }) {
  const now = Date.now();

  // Sort by date
  const sorted = [...milestones].sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
    const db_ = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
    return da - db_;
  });

  if (sorted.length === 0) {
    return (
      <div style={{ padding: "24px 0", color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
        No milestones yet — add one below.
      </div>
    );
  }

  // Calculate date range for positioning
  const dates = sorted.map(m => (m.date?.toDate ? m.date.toDate() : new Date(m.date || 0)));
  const minDate = Math.min(...dates.map(d => d.getTime()));
  const maxDate = Math.max(...dates.map(d => d.getTime()), now);
  const range = maxDate - minDate || 86400000 * 30;

  // Min width per item so it scrolls nicely
  const itemMinWidth = 120;
  const totalWidth = Math.max(sorted.length * itemMinWidth, 600);

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8, paddingLeft: 12, paddingRight: 12 }}>
      <div style={{ position: "relative", minWidth: totalWidth, height: 140 }}>

        {/* Today marker */}
        {(() => {
          const pct = ((now - minDate) / range) * 100;
          if (pct < 0 || pct > 100) return null;
          return (
            <div style={{
              position: "absolute", left: `${pct}%`, top: 0, bottom: 0,
              width: 1, background: "var(--purple)", opacity: 0.4,
              zIndex: 0,
            }}>
              <span style={{
                position: "absolute", top: 0, left: 4,
                fontSize: 9, fontWeight: 700, color: "var(--purple)",
                textTransform: "uppercase", letterSpacing: "0.06em",
                whiteSpace: "nowrap",
              }}>Today</span>
            </div>
          );
        })()}

        {/* Spine line */}
        <div style={{
          position: "absolute", left: 0, right: 0, top: 60,
          height: 2, background: "var(--border)",
        }} />

        {/* Milestone nodes */}
        {sorted.map((m, i) => {
          const d = m.date?.toDate ? m.date.toDate() : new Date(m.date || 0);
          const pct = ((d.getTime() - minDate) / range) * 100;
          const isPast = d.getTime() < now;
          const isOverdue = !m.completed && isPast;
          const dotColour = m.completed
            ? "var(--green)"
            : isOverdue
            ? "var(--red)"
            : m.isDeadline
            ? "var(--amber)"
            : "var(--purple)";

          // Alternate label above/below to prevent overlap
          const labelAbove = i % 2 === 0;

          return (
            <div
              key={m.id}
              style={{
                position: "absolute",
                left: `clamp(${itemMinWidth/2}px, ${pct}%, calc(100% - ${itemMinWidth/2}px))`,
                top: 0, width: itemMinWidth,
                transform: "translateX(-50%)",
                display: "flex", flexDirection: "column",
                alignItems: "center",
              }}
            >
              {/* Label above */}
              {labelAbove && (
                <div style={{ height: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: isOverdue ? "var(--red)" : "var(--text-second)", textAlign: "center", lineHeight: 1.3, maxWidth: 110, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {MILESTONE_ICONS[m.type] || "•"} {m.type}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{fmtShortDate(m.date)}</span>
                </div>
              )}
              {!labelAbove && <div style={{ height: 52 }} />}

              {/* Dot — clickable to toggle */}
              <button
                onClick={() => onToggle(m.id, !m.completed)}
                title={m.completed ? "Mark incomplete" : "Mark complete"}
                style={{
                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                  background: m.completed ? dotColour : "var(--surface)",
                  border: `2px solid ${dotColour}`,
                  cursor: "pointer", zIndex: 1, position: "relative",
                  transition: "all 0.15s",
                  boxShadow: isOverdue ? `0 0 0 3px rgba(220,38,38,0.15)` : "none",
                }}
              />

              {/* Label below */}
              {!labelAbove && (
                <div style={{ height: 52, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: isOverdue ? "var(--red)" : "var(--text-second)", textAlign: "center", lineHeight: 1.3, maxWidth: 110, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {MILESTONE_ICONS[m.type] || "•"} {m.type}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{fmtShortDate(m.date)}</span>
                </div>
              )}
              {labelAbove && <div style={{ height: 52 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Milestone list (below timeline) ─────────────────────────────────────────

function MilestoneList({ milestones, onToggle }) {
  const now = Date.now();
  const sorted = [...milestones].sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
    const db_ = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
    return da - db_;
  });

  return (
    <div style={{ marginTop: 16 }}>
      {sorted.map(m => {
        const d = m.date?.toDate ? m.date.toDate() : new Date(m.date || 0);
        const isOverdue = !m.completed && d.getTime() < now;
        return (
          <div key={m.id} style={{
            display: "flex", gap: 10, padding: "8px 0",
            borderBottom: "1px solid var(--border)",
            opacity: m.completed ? 0.5 : 1,
          }}>
            <button
              onClick={() => onToggle(m.id, !m.completed)}
              style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 2,
                border: `2px solid ${m.completed ? "var(--green)" : isOverdue ? "var(--red)" : "var(--border2)"}`,
                background: m.completed ? "var(--green)" : "transparent",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {m.completed && <span style={{ color: "white", fontSize: 10 }}>✓</span>}
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13 }}>{MILESTONE_ICONS[m.type] || "•"}</span>
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: m.completed ? "var(--text-muted)" : "var(--text-primary)",
                  textDecoration: m.completed ? "line-through" : "none",
                }}>
                  {m.type}
                </span>
                {m.isDeadline && m.deadlineType && (
                  <Pill color={m.deadlineType === "hard" ? "red" : "amber"} style={{ fontSize: 9 }}>
                    {m.deadlineType}
                  </Pill>
                )}
                {isOverdue && <Pill color="red" style={{ fontSize: 9 }}>overdue</Pill>}
                <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                  {fmtDate(m.date)}
                </span>
              </div>
              {m.note && (
                <p style={{ fontSize: 12, color: "var(--text-second)", marginTop: 3, lineHeight: 1.5 }}>{m.note}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Add milestone form ───────────────────────────────────────────────────────

function AddMilestoneForm({ reqId }) {
  const { user } = useAuth();
  const [type, setType] = useState(MILESTONE_TYPES[0]);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [deadlineType, setDeadlineType] = useState("hard");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const isDeadline = type === "Deadline";

  async function handleAdd() {
    if (!date) return;
    setSaving(true);
    // Optimistic: show saved state immediately
    const optimisticId = Date.now();
    try {
      await addDoc(collection(db, "acRequests", reqId, "milestones"), {
        type,
        date: fromInputDate(date),
        completed: false,
        note: note.trim() || null,
        isDeadline,
        deadlineType: isDeadline ? deadlineType : null,
        createdBy: user?.displayName || user?.email || "unknown",
        createdAt: serverTimestamp(),
      });
      setType(MILESTONE_TYPES[0]);
      setDate("");
      setNote("");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", padding: "16px 20px", marginTop: 20,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
        Add milestone
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 140px", gap: 8, marginBottom: 8 }}>
        <Select value={type} onChange={e => setType(e.target.value)}>
          {MILESTONE_TYPES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      {isDeadline && (
        <div style={{ marginBottom: 8 }}>
          <Select value={deadlineType} onChange={e => setDeadlineType(e.target.value)}>
            <option value="hard">Hard deadline</option>
            <option value="soft">Soft deadline</option>
          </Select>
        </div>
      )}
      <Textarea
        value={note} onChange={e => setNote(e.target.value)}
        placeholder="Note (optional)" rows={2}
        style={{ marginBottom: 10, fontSize: 12 }}
      />
      <Btn
        variant={justSaved ? "success" : "primary"}
        size="sm"
        onClick={handleAdd}
        disabled={saving || !date}
      >
        {saving ? "Adding…" : justSaved ? "✓ Added" : "Add milestone"}
      </Btn>
    </div>
  );
}

// ─── Escalation panel ─────────────────────────────────────────────────────────

function EscalationPanel({ req }) {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [multiplier, setMultiplier] = useState(req.escalationMultiplier ?? 1.0);
  const [note, setNote] = useState(req.escalationNote || "");
  const [saving, setSaving] = useState(false);

  const current = req.escalationMultiplier ?? 1.0;
  const isEscalated = current !== 1.0;

  async function save() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "acRequests", req.id), {
        escalationMultiplier: multiplier,
        escalationNote: note.trim() || null,
        escalationSetBy: user?.displayName || user?.email || "unknown",
        escalationSetAt: serverTimestamp(),
      });
      setShow(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
            Escalation multiplier
          </p>
          <p style={{ fontSize: 14, fontWeight: 600, color: current > 1 ? "var(--red)" : current < 1 ? "var(--amber)" : "var(--text-second)" }}>
            {current === 0.5 ? "0.5× — de-prioritised" : current === 1.5 ? "1.5× — escalated" : "1.0× — normal"}
          </p>
          {req.escalationSetBy && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
              Set by {req.escalationSetBy} · {fmtDate(req.escalationSetAt)}
            </p>
          )}
          {req.escalationNote && (
            <p style={{ fontSize: 12, color: "var(--text-second)", marginTop: 4, fontStyle: "italic" }}>"{req.escalationNote}"</p>
          )}
        </div>
        <Btn variant="ghost" size="sm" onClick={() => setShow(s => !s)}>{show ? "Cancel" : "Adjust"}</Btn>
      </div>
      {show && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {[0.5, 1.0, 1.5].map(v => (
              <button key={v} onClick={() => setMultiplier(v)} style={{
                flex: 1, padding: "8px 0", borderRadius: "var(--radius-sm)", cursor: "pointer",
                border: `2px solid ${multiplier === v ? "var(--purple)" : "var(--border)"}`,
                background: multiplier === v ? "var(--purple-light)" : "var(--surface)",
                color: multiplier === v ? "var(--purple)" : "var(--text-second)",
                fontFamily: "inherit", fontSize: 13, fontWeight: 600,
              }}>
                {v === 0.5 ? "0.5×" : v === 1.0 ? "1.0×" : "1.5×"}
              </button>
            ))}
          </div>
          <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason (optional)" rows={2} style={{ marginBottom: 10, fontSize: 12 }} />
          <Btn variant="primary" size="sm" onClick={save} disabled={saving} style={{ width: "100%" }}>
            {saving ? "Saving…" : "Save"}
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ACRequestPage({ req, milestones, weights, arrCeiling = DEFAULT_ARR_CEILING, onBack }) {
  const { user } = useAuth();
  const { toasts, toast } = useToast();

  // Deliverables summary — editable sticky note
  const [deliverables, setDeliverables] = useState(req.deliverablesSummary || "");
  const [deliverablesSaving, setDeliverablesSaving] = useState(false);
  const [deliverablesTimer, setDeliverablesTimer] = useState(null);

  // Auto-save deliverables after 1.5s of no typing
  useEffect(() => {
    setDeliverables(req.deliverablesSummary || "");
  }, [req.id]);

  function handleDeliverablesChange(val) {
    setDeliverables(val);
    if (deliverablesTimer) clearTimeout(deliverablesTimer);
    const t = setTimeout(async () => {
      setDeliverablesSaving(true);
      try {
        await updateDoc(doc(db, "acRequests", req.id), {
          deliverablesSummary: val.trim() || null,
          lastUpdatedBy: user?.email || "unknown",
          lastUpdatedAt: serverTimestamp(),
        });
      } finally {
        setDeliverablesSaving(false);
      }
    }, 1500);
    setDeliverablesTimer(t);
  }

  async function handleToggleMilestone(milestoneId, completed) {
    try {
      await updateDoc(doc(db, "acRequests", req.id, "milestones", milestoneId), { completed });
    } catch (e) {
      toast("Failed to update milestone", "error");
    }
  }

  const score = calcScore(req, weights, arrCeiling);
  const isEscalated = (req.escalationMultiplier ?? 1) !== 1;

  // Derive next meeting and next deadline from milestones
  const now = Date.now();
  const futureMilestones = milestones.filter(m => {
    if (m.completed) return false;
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date || 0);
    return d.getTime() > now;
  }).sort((a, b) => {
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
    const db_ = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
    return da - db_;
  });
  const nextMeeting = futureMilestones.find(m =>
    ["Kick off meeting", "Handover call", "Meeting scheduled", "Customer update"].includes(m.type)
  );
  const nextDeadline = futureMilestones.find(m => m.isDeadline || m.type === "Deadline");

  return (
    <div style={{ padding: "24px 28px 64px", maxWidth: 860, margin: "0 auto" }}>
      <ToastContainer toasts={toasts} />

      {/* Back nav */}
      <button onClick={onBack} style={{
        background: "none", border: "none", cursor: "pointer",
        fontSize: 13, color: "var(--text-muted)", fontFamily: "inherit",
        display: "flex", alignItems: "center", gap: 6, marginBottom: 20,
        padding: 0,
      }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
        onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
      >
        ← Back to AC Manager
      </button>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
          <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 24, color: "var(--text-primary)" }}>
            {req.accountName}
          </h1>
          <Pill color={req.requestType === "Technical" ? "blue" : req.requestType === "Onboarding" ? "teal" : "purple"}>
            {req.requestType}
          </Pill>
          {isEscalated && (
            <Pill color={(req.escalationMultiplier ?? 1) > 1 ? "red" : "grey"}>
              {(req.escalationMultiplier ?? 1) > 1 ? "↑ Escalated" : "↓ De-prioritised"}
            </Pill>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{req.sfName}</span>
          {req.jiraKey && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{req.jiraKey}</span>}
          <a href={req.sfRecordUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: "var(--purple)", textDecoration: "none", fontWeight: 500 }}>
            Salesforce ↗
          </a>
          {req.jiraKey && (
            <a href={`https://safetyculture.atlassian.net/browse/${req.jiraKey}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--blue)", textDecoration: "none", fontWeight: 500 }}>
              Jira ↗
            </a>
          )}
        </div>
      </div>

      {/* Stat strip */}
      <div style={{
        display: "flex", gap: 0, flexWrap: "wrap",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
        marginBottom: 20, boxShadow: "var(--shadow-sm)",
      }}>
        {[
          { label: "ARR",       value: fmtARR(req.arr) },
          { label: "Priority",  value: req.sfPriority || "—", pill: PRIORITY_COLOURS[req.sfPriority] },
          { label: "Assigned",  value: req.assignedTo || "Unassigned", avatar: req.assignedTo },
          { label: "Status",    value: req.sfStatus || "—", pill: STATUS_COLOURS[req.sfStatus] },
          { label: "Score",     value: Math.round(score * 100), scoreColour: score * 100 >= 70 ? "var(--red)" : score * 100 >= 40 ? "var(--amber)" : "var(--green)" },
          { label: "Age",       value: fmtAge(req.createdAt) },
          { label: "Next meeting", value: nextMeeting ? fmtShortDate(nextMeeting.date) : "—" },
          { label: "Deadline",  value: nextDeadline ? fmtShortDate(nextDeadline.date) : "—",
            warn: nextDeadline && (() => { const d = nextDeadline.date?.toDate ? nextDeadline.date.toDate() : new Date(nextDeadline.date); return (d - Date.now()) < 7 * 86400000; })() },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            padding: "12px 16px", flex: 1, minWidth: 80,
            borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
          }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
              {s.label}
            </p>
            {s.avatar ? (
              <div style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden" }}>
                <Avatar name={s.avatar} size={18} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.avatar.split(" ")[0]}</span>
              </div>
            ) : s.pill ? (
              <Pill color={s.pill} style={{ fontSize: 11 }}>{s.value}</Pill>
            ) : (
              <p style={{
                fontSize: 13, fontWeight: 600,
                color: s.scoreColour || (s.warn ? "var(--red)" : "var(--text-primary)"),
              }}>
                {s.value}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Deliverables summary */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <Label>Deliverables summary</Label>
          {deliverablesSaving && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Saving…</span>}
        </div>
        <Textarea
          value={deliverables}
          onChange={e => handleDeliverablesChange(e.target.value)}
          placeholder="Plain-language summary of what we're delivering — for managers and stakeholders who need context at a glance."
          rows={3}
          style={{ background: "#FFFEF0", border: "1px solid #E8E0A0", fontSize: 13 }}
        />
      </div>

      {/* Timeline section */}
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", padding: "18px 20px",
        marginBottom: 20, boxShadow: "var(--shadow-sm)",
      }}>
        <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
          Milestone timeline
        </p>
        <MilestoneTimeline milestones={milestones} onToggle={handleToggleMilestone} />
        <MilestoneList milestones={milestones} onToggle={handleToggleMilestone} />
        <AddMilestoneForm reqId={req.id} />
      </div>

      {/* Two-col bottom section */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* SF read-only */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", padding: "18px 20px",
          boxShadow: "var(--shadow-sm)",
        }}>
          <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
            Salesforce fields
          </p>
          {[
            { label: "SF Name",    value: req.sfName },
            { label: "Status",     value: req.sfStatus },
            { label: "Priority",   value: req.sfPriority },
            { label: "ARR",        value: fmtARR(req.arr) },
            { label: "Completion", value: fmtDate(req.preferredCompletion) },
            { label: "Opened",     value: fmtDate(req.createdAt) },
            { label: "Assigned",   value: req.assignedTo || "Unassigned" },
          ].map(f => (
            <div key={f.label} style={{ display: "flex", gap: 8, padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", width: 90, flexShrink: 0 }}>{f.label}</span>
              <span style={{ fontSize: 12, color: "var(--text-second)" }}>{f.value || "—"}</span>
            </div>
          ))}
          {req.description && (
            <p style={{ fontSize: 12, color: "var(--text-second)", marginTop: 10, lineHeight: 1.6 }}>{req.description}</p>
          )}
        </div>

        {/* Escalation */}
        <div>
          <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 14 }}>
            Priority adjustment
          </p>
          <EscalationPanel req={req} />
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

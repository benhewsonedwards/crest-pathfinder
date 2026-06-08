import { useState, useEffect } from "react";
import {
  collection, addDoc, updateDoc, doc,
  serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { Btn, Input, Select, Textarea, Pill, Avatar, Label, useToast, ToastContainer } from "./UI";
import { calcScore } from "../pages/ACManagerPage";

// ─── Milestone type picklist ──────────────────────────────────────────────────

const MILESTONE_TYPES = [
  "Request opened",
  "Kick off meeting",
  "Discovery complete",
  "POC presented",
  "Solution approved",
  "Build started",
  "Testing",
  "Handover call",
  "Go live",
  "Deadline",
  "Customer update",
  "Internal update",
  "Blocker raised",
  "Blocker resolved",
  "Meeting scheduled",
  "Reassigned",
  "Closed",
];

const MILESTONE_ICONS = {
  "Request opened":   "📥",
  "Kick off meeting": "🤝",
  "Discovery complete": "🔍",
  "POC presented":    "💡",
  "Solution approved":"✅",
  "Build started":    "🔨",
  "Testing":          "🧪",
  "Handover call":    "📞",
  "Go live":          "🚀",
  "Deadline":         "📅",
  "Customer update":  "💬",
  "Internal update":  "📝",
  "Blocker raised":   "🚧",
  "Blocker resolved": "✔",
  "Meeting scheduled":"📆",
  "Reassigned":       "🔄",
  "Closed":           "🔒",
};

// ─── Formatting ────────────────────────────────────────────────────────────────

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtARR(n) {
  if (!n) return "—";
  if (n >= 1000000) return `£${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `£${(n / 1000).toFixed(0)}k`;
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

// ─── Section headers ──────────────────────────────────────────────────────────

function SectionHead({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", color: "var(--text-muted)",
      padding: "14px 20px 8px", borderTop: "1px solid var(--border)",
      background: "var(--surface2)",
    }}>
      {children}
    </p>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "6px 20px", alignItems: "flex-start" }}>
      <span style={{ fontSize: 12, color: "var(--text-muted)", width: 130, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── Milestone row ────────────────────────────────────────────────────────────

function MilestoneRow({ m, onToggle }) {
  const now = Date.now();
  const d = m.date?.toDate ? m.date.toDate() : new Date(m.date || 0);
  const isPast = d < now;
  const isOverdue = !m.completed && isPast;

  return (
    <div style={{
      display: "flex", gap: 10, padding: "9px 20px", alignItems: "flex-start",
      borderBottom: "1px solid var(--border)",
      background: isOverdue ? "rgba(220,38,38,0.03)" : "transparent",
      opacity: m.completed ? 0.55 : 1,
    }}>
      {/* Tick */}
      <button
        onClick={() => onToggle(m.id, !m.completed)}
        title={m.completed ? "Mark incomplete" : "Mark complete"}
        style={{
          width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
          border: `2px solid ${m.completed ? "var(--green)" : isOverdue ? "var(--red)" : "var(--border2)"}`,
          background: m.completed ? "var(--green)" : "transparent",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
      >
        {m.completed && <span style={{ color: "white", fontSize: 11, lineHeight: 1 }}>✓</span>}
      </button>

      {/* Icon + content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
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
          {isOverdue && (
            <Pill color="red" style={{ fontSize: 9 }}>overdue</Pill>
          )}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {fmtDate(m.date)}
          {m.createdBy && m.createdBy !== "seed-script" && (
            <span style={{ marginLeft: 8 }}>· {m.createdBy}</span>
          )}
        </p>
        {m.note && (
          <p style={{ fontSize: 12, color: "var(--text-second)", marginTop: 3, lineHeight: 1.5 }}>{m.note}</p>
        )}
      </div>
    </div>
  );
}

// ─── Add milestone form ───────────────────────────────────────────────────────

function AddMilestoneForm({ reqId, onAdded }) {
  const { user, profile } = useAuth();
  const [type, setType]   = useState(MILESTONE_TYPES[0]);
  const [date, setDate]   = useState("");
  const [note, setNote]   = useState("");
  const [saving, setSaving] = useState(false);

  const isDeadline = type === "Deadline";
  const [deadlineType, setDeadlineType] = useState("hard");

  async function handleAdd() {
    if (!date) return;
    setSaving(true);
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
      onAdded?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "12px 20px 16px", background: "var(--surface2)", borderTop: "1px solid var(--border)" }}>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
        Add milestone
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8, marginBottom: 8 }}>
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
        style={{ marginBottom: 8, fontSize: 12 }}
      />
      <Btn variant="primary" size="sm" onClick={handleAdd} disabled={saving || !date}>
        {saving ? "Adding…" : "Add milestone"}
      </Btn>
    </div>
  );
}

// ─── Main drawer ──────────────────────────────────────────────────────────────

export default function ACRequestDrawer({ req, milestones, weights, onClose }) {
  const { user, profile } = useAuth();
  const { toasts, toast } = useToast();

  // Editable app field state
  const [nextMeeting,        setNextMeeting]    = useState(toInputDate(req.nextMeeting));
  const [nextDeadline,       setNextDeadline]   = useState(toInputDate(req.nextDeadline));
  const [deadlineType,       setDeadlineType]   = useState(req.deadlineType || "hard");
  const [deliverables,       setDeliverables]   = useState(req.deliverablesSummary || "");
  const [workEstimate,       setWorkEstimate]   = useState(req.workEstimate || "");
  const [saving,             setSaving]         = useState(false);

  // Escalation state
  const [showEscalation,     setShowEscalation] = useState(false);
  const [newMultiplier,      setNewMultiplier]  = useState(req.escalationMultiplier ?? 1.0);
  const [escalationNote,     setEscalationNote] = useState(req.escalationNote || "");
  const [savingEsc,          setSavingEsc]      = useState(false);

  // Reset local state when req changes (e.g. Firestore live update)
  useEffect(() => {
    setNextMeeting(toInputDate(req.nextMeeting));
    setNextDeadline(toInputDate(req.nextDeadline));
    setDeadlineType(req.deadlineType || "hard");
    setDeliverables(req.deliverablesSummary || "");
    setWorkEstimate(req.workEstimate || "");
    setNewMultiplier(req.escalationMultiplier ?? 1.0);
    setEscalationNote(req.escalationNote || "");
  }, [req.id]);

  const score = calcScore(req, weights);
  const isDirty = (
    nextMeeting   !== toInputDate(req.nextMeeting)   ||
    nextDeadline  !== toInputDate(req.nextDeadline)  ||
    deadlineType  !== (req.deadlineType || "hard")   ||
    deliverables  !== (req.deliverablesSummary || "")  ||
    workEstimate  !== (req.workEstimate || "")
  );

  async function handleSave() {
    setSaving(true);
    try {
      await updateDoc(doc(db, "acRequests", req.id), {
        nextMeeting:          nextMeeting  ? fromInputDate(nextMeeting)  : null,
        nextDeadline:         nextDeadline ? fromInputDate(nextDeadline) : null,
        deadlineType:         nextDeadline ? deadlineType : null,
        deliverablesSummary:  deliverables.trim() || null,
        workEstimate:         workEstimate || null,
        lastUpdatedBy:        user?.email || "unknown",
        lastUpdatedAt:        serverTimestamp(),
      });
      toast("Saved", "success");
    } catch (e) {
      toast("Save failed — " + e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEscalation() {
    setSavingEsc(true);
    try {
      await updateDoc(doc(db, "acRequests", req.id), {
        escalationMultiplier: newMultiplier,
        escalationNote:       escalationNote.trim() || null,
        escalationSetBy:      user?.displayName || user?.email || "unknown",
        escalationSetAt:      serverTimestamp(),
      });
      toast("Escalation updated", "success");
      setShowEscalation(false);
    } catch (e) {
      toast("Failed — " + e.message, "error");
    } finally {
      setSavingEsc(false);
    }
  }

  async function handleToggleMilestone(milestoneId, completed) {
    try {
      await updateDoc(
        doc(db, "acRequests", req.id, "milestones", milestoneId),
        { completed }
      );
    } catch (e) {
      toast("Failed to update milestone", "error");
    }
  }

  // Sort milestones: incomplete first (by date asc), then completed
  const sortedMilestones = [...milestones].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const da = a.date?.toDate ? a.date.toDate() : new Date(a.date || 0);
    const db_ = b.date?.toDate ? b.date.toDate() : new Date(b.date || 0);
    return da - db_;
  });

  const currentEscalation = req.escalationMultiplier ?? 1.0;
  const isEscalated = currentEscalation !== 1.0;

  return (
    <>
      <ToastContainer toasts={toasts} />

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.2)",
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 480, zIndex: 201, display: "flex", flexDirection: "column",
        background: "var(--surface)", boxShadow: "var(--shadow-lg)",
        overflowY: "auto",
      }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          background: "var(--surface2)", position: "sticky", top: 0, zIndex: 10,
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 16, color: "var(--text-primary)" }}>
                {req.accountName}
              </h2>
              <Pill color={req.requestType === "Technical" ? "blue" : req.requestType === "Onboarding" ? "teal" : "purple"} style={{ fontSize: 10 }}>
                {req.requestType}
              </Pill>
              {isEscalated && (
                <Pill color={currentEscalation > 1 ? "red" : "grey"} style={{ fontSize: 10 }}>
                  {currentEscalation > 1 ? "↑ Escalated" : "↓ De-prioritised"}
                </Pill>
              )}
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {req.sfName}
              {req.jiraKey && <span style={{ marginLeft: 8 }}>{req.jiraKey}</span>}
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", fontSize: 20, cursor: "pointer",
            color: "var(--text-muted)", lineHeight: 1, flexShrink: 0, padding: "2px 4px",
          }}>×</button>
        </div>

        {/* ── Score + links strip ─────────────────────────────────── */}
        <div style={{
          padding: "10px 20px", display: "flex", alignItems: "center",
          gap: 12, background: "var(--surface2)", borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Score</span>
            <div style={{ width: 80, height: 5, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                width: `${Math.min(score * 100, 100)}%`, height: "100%", borderRadius: 99,
                background: score * 100 >= 70 ? "var(--red)" : score * 100 >= 40 ? "var(--amber)" : "var(--green)",
              }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-second)" }}>
              {Math.round(score * 100)}
            </span>
          </div>
          <a
            href={req.sfRecordUrl} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 12, color: "var(--purple)", textDecoration: "none", fontWeight: 500 }}
          >
            Salesforce ↗
          </a>
          {req.jiraKey && (
            <a
              href={`https://safetyculture.atlassian.net/browse/${req.jiraKey}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: "var(--blue)", textDecoration: "none", fontWeight: 500 }}
            >
              {req.jiraKey} ↗
            </a>
          )}
        </div>

        {/* ── SF fields (read only) ───────────────────────────────── */}
        <SectionHead>Salesforce — read only</SectionHead>

        <FieldRow label="Account">
          <span style={{ fontSize: 13, fontWeight: 500 }}>{req.accountName}</span>
        </FieldRow>
        <FieldRow label="Status">
          <Pill color={{ "In Progress":"blue","Scoping":"purple","In Review":"teal","Waiting on Customer":"grey","Unplanned":"grey" }[req.sfStatus] || "grey"} style={{ fontSize: 11 }}>
            {req.sfStatus || "—"}
          </Pill>
        </FieldRow>
        <FieldRow label="Priority">
          <Pill color={{ Critical:"red", High:"orange", Medium:"amber", Low:"grey" }[req.priority] || "grey"} style={{ fontSize: 11 }}>
            {req.priority || "—"}
          </Pill>
        </FieldRow>
        <FieldRow label="ARR">
          <span style={{ fontSize: 13 }}>{fmtARR(req.arr)}</span>
        </FieldRow>
        <FieldRow label="Assigned to">
          {req.assignedTo
            ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Avatar name={req.assignedTo} size={20} />
                <span style={{ fontSize: 13 }}>{req.assignedTo}</span>
              </div>
            : <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Unassigned</span>
          }
        </FieldRow>
        <FieldRow label="Preferred completion">
          <span style={{ fontSize: 13 }}>{fmtDate(req.preferredCompletion)}</span>
        </FieldRow>
        <FieldRow label="Request opened">
          <span style={{ fontSize: 13 }}>{fmtDate(req.createdAt)}</span>
        </FieldRow>
        {req.description && (
          <div style={{ padding: "8px 20px 12px" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>Description</p>
            <p style={{ fontSize: 13, color: "var(--text-second)", lineHeight: 1.6 }}>{req.description}</p>
          </div>
        )}

        {/* ── App fields (editable) ───────────────────────────────── */}
        <SectionHead>Working details — editable</SectionHead>

        <div style={{ padding: "10px 20px 4px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <Label style={{ display: "block", marginBottom: 4 }}>Next meeting</Label>
              <Input type="date" value={nextMeeting} onChange={e => setNextMeeting(e.target.value)} />
            </div>
            <div>
              <Label style={{ display: "block", marginBottom: 4 }}>Next deadline</Label>
              <Input type="date" value={nextDeadline} onChange={e => setNextDeadline(e.target.value)} />
            </div>
          </div>

          {nextDeadline && (
            <div style={{ marginBottom: 10 }}>
              <Label style={{ display: "block", marginBottom: 4 }}>Deadline type</Label>
              <Select value={deadlineType} onChange={e => setDeadlineType(e.target.value)}>
                <option value="hard">Hard — customer or contract deadline</option>
                <option value="soft">Soft — preferred but flexible</option>
              </Select>
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <Label style={{ display: "block", marginBottom: 4 }}>Work estimate</Label>
            <Select value={workEstimate} onChange={e => setWorkEstimate(e.target.value)}>
              <option value="">— not set —</option>
              <option value="low">Low — &lt; 1 day</option>
              <option value="medium">Medium — 1–3 days</option>
              <option value="high">High — &gt; 3 days</option>
            </Select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <Label style={{ display: "block", marginBottom: 4 }}>Deliverables summary</Label>
            <Textarea
              value={deliverables}
              onChange={e => setDeliverables(e.target.value)}
              placeholder="What are we building or delivering for this request?"
              rows={3}
            />
          </div>

          {req.lastUpdatedAt && (
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
              Last updated {fmtDate(req.lastUpdatedAt)} by {req.lastUpdatedBy}
            </p>
          )}

          <Btn
            variant={isDirty ? "primary" : "secondary"}
            onClick={handleSave}
            disabled={saving || !isDirty}
            style={{ width: "100%" }}
          >
            {saving ? "Saving…" : isDirty ? "Save changes" : "No changes"}
          </Btn>
        </div>

        {/* ── Escalation ──────────────────────────────────────────── */}
        <SectionHead>Escalation / priority adjustment</SectionHead>

        <div style={{ padding: "10px 20px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13 }}>
                Current multiplier:&nbsp;
                <strong style={{ color: currentEscalation > 1 ? "var(--red)" : currentEscalation < 1 ? "var(--amber)" : "var(--text-primary)" }}>
                  {currentEscalation === 0.5 ? "0.5× (de-prioritised)" : currentEscalation === 1.5 ? "1.5× (escalated)" : "1.0× (normal)"}
                </strong>
              </p>
              {req.escalationSetBy && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  Set by {req.escalationSetBy} · {fmtDate(req.escalationSetAt)}
                </p>
              )}
              {req.escalationNote && (
                <p style={{ fontSize: 12, color: "var(--text-second)", marginTop: 4, fontStyle: "italic" }}>
                  "{req.escalationNote}"
                </p>
              )}
            </div>
            <Btn variant="ghost" size="sm" onClick={() => setShowEscalation(e => !e)}>
              {showEscalation ? "Cancel" : "Adjust"}
            </Btn>
          </div>

          {showEscalation && (
            <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
              <Label style={{ display: "block", marginBottom: 8 }}>Multiplier</Label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {[0.5, 1.0, 1.5].map(v => (
                  <button
                    key={v}
                    onClick={() => setNewMultiplier(v)}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: "var(--radius-sm)", cursor: "pointer",
                      border: `2px solid ${newMultiplier === v ? "var(--purple)" : "var(--border)"}`,
                      background: newMultiplier === v ? "var(--purple-light)" : "var(--surface)",
                      color: newMultiplier === v ? "var(--purple)" : "var(--text-second)",
                      fontFamily: "inherit", fontSize: 13, fontWeight: 600, transition: "all 0.13s",
                    }}
                  >
                    {v === 0.5 ? "0.5×" : v === 1.0 ? "1.0×" : "1.5×"}
                  </button>
                ))}
              </div>
              <Textarea
                value={escalationNote}
                onChange={e => setEscalationNote(e.target.value)}
                placeholder="Reason for adjustment (optional)"
                rows={2}
                style={{ marginBottom: 10, fontSize: 12 }}
              />
              <Btn variant="primary" size="sm" onClick={handleSaveEscalation} disabled={savingEsc} style={{ width: "100%" }}>
                {savingEsc ? "Saving…" : "Save escalation"}
              </Btn>
            </div>
          )}
        </div>

        {/* ── Milestone timeline ───────────────────────────────────── */}
        <SectionHead>Milestone timeline</SectionHead>

        {sortedMilestones.length === 0 ? (
          <p style={{ padding: "12px 20px", fontSize: 13, color: "var(--text-muted)" }}>
            No milestones yet.
          </p>
        ) : (
          sortedMilestones.map(m => (
            <MilestoneRow
              key={m.id}
              m={m}
              onToggle={handleToggleMilestone}
            />
          ))
        )}

        <AddMilestoneForm reqId={req.id} />

      </div>
    </>
  );
}

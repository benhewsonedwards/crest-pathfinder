import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Card, CardHeader, Label, Pill, Btn, Avatar } from "../components/UI";
import ACRequestPage from "./ACRequestPage";
import { calcScore, DEFAULT_WEIGHTS, DEFAULT_ARR_CEILING } from "../lib/acRanking";


// ─── Flag helpers ─────────────────────────────────────────────────────────────

function getFlags(req, milestones) {
  const flags = [];
  const now = Date.now();

  // Past + incomplete milestone
  const pastIncomplete = (milestones || []).some(m => {
    if (m.completed) return false;
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date || 0);
    return d < now;
  });
  if (pastIncomplete) flags.push({ key: "overdue", label: "Overdue milestone", colour: "var(--red)" });

  // No future action planned
  const hasFutureAction = (milestones || []).some(m => {
    if (m.completed) return false;
    const d = m.date?.toDate ? m.date.toDate() : new Date(m.date || 0);
    return d > now;
  });
  if (!hasFutureAction) flags.push({ key: "noaction", label: "No next action", colour: "var(--amber)" });

  return flags;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtARR(n) {
  if (!n) return "—";
  if (n >= 1000000) return `£${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000)    return `£${(n / 1000).toFixed(0)}k`;
  return `£${n}`;
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function daysUntil(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Math.ceil((d - Date.now()) / 86400000);
}

function fmtAge(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const days = Math.floor((Date.now() - d) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1d";
  if (days < 7)   return `${days}d`;
  if (days < 30)  return `${Math.floor(days / 7)}w`;
  return `${Math.floor(days / 30)}mo`;
}

const PRIORITY_ORDER = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const PRIORITY_COLOURS = {
  Critical: "red", High: "orange", Medium: "amber", Low: "grey",
};
const STATUS_COLOURS = {
  "In Progress":        "blue",
  "Scoping":            "purple",
  "In Review":          "teal",
  "Waiting on Customer":"grey",
  "Unplanned":          "grey",
  "On Hold":            "amber",
  "Closed":             "green",
};

// ─── Column header ─────────────────────────────────────────────────────────────

function ColHead({ label, width, right = false, style }) {
  return (
    <div style={{
      width, flexShrink: 0,
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
      textTransform: "uppercase", color: "var(--text-muted)",
      textAlign: right ? "right" : "left",
      ...style,
    }}>
      {label}
    </div>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score }) {
  const pct = score * 100;
  const colour = pct >= 70 ? "var(--red)" : pct >= 40 ? "var(--amber)" : "var(--green)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, width: 80 }}>
      <div style={{ flex: 1, height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: colour, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color: colour, flexShrink: 0, width: 26, textAlign: "right" }}>
        {Math.round(pct)}
      </span>
    </div>
  );
}

// ─── Request row ─────────────────────────────────────────────────────────────

function RequestRow({ req, rank, milestones, weights, arrCeiling, onClick, tab }) {
  const [hovered, setHovered] = useState(false);
  const score = calcScore(req, weights, arrCeiling);
  const flags = getFlags(req, milestones);
  const du = daysUntil(req.nextDeadline || req.preferredCompletion);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 0,
        padding: "11px 18px", cursor: "pointer",
        background: hovered ? "var(--surface2)" : "transparent",
        borderBottom: "1px solid var(--border)",
        transition: "background 0.1s",
      }}
    >
      {/* Rank */}
      <div style={{ width: 32, flexShrink: 0, fontSize: 12, fontWeight: 700, color: rank <= 3 ? "var(--purple)" : "var(--text-muted)" }}>
        {rank}
      </div>

      {/* Account */}
      <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {req.accountName}
        </p>
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
          {req.sfName}
          {req.jiraKey && <span style={{ marginLeft: 6 }}>{req.jiraKey}</span>}
        </p>
      </div>

      {/* Type pill — only in All tab */}
      {tab === "all" && (
        <div style={{ width: 110, flexShrink: 0, marginRight: 12 }}>
          <Pill color={req.requestType === "Technical" ? "blue" : req.requestType === "Onboarding" ? "teal" : "purple"} style={{ fontSize: 10 }}>
            {req.requestType}
          </Pill>
        </div>
      )}

      {/* Assigned to */}
      <div style={{ width: 120, flexShrink: 0, marginRight: 12, display: "flex", alignItems: "center", gap: 6 }}>
        {req.assignedTo
          ? <>
              <Avatar name={req.assignedTo} size={22} />
              <span style={{ fontSize: 12, color: "var(--text-second)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {req.assignedTo.split(" ")[0]}
              </span>
            </>
          : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Unassigned</span>
        }
      </div>

      {/* Priority */}
      <div style={{ width: 80, flexShrink: 0, marginRight: 12 }}>
        <Pill color={PRIORITY_COLOURS[req.sfPriority] || "grey"} style={{ fontSize: 10 }}>
          {req.sfPriority || "—"}
        </Pill>
      </div>

      {/* ARR */}
      <div style={{ width: 70, flexShrink: 0, textAlign: "right", marginRight: 12, fontSize: 12, fontWeight: 600, color: "var(--text-second)" }}>
        {fmtARR(req.arr)}
      </div>

      {/* Age */}
      <div style={{ width: 40, flexShrink: 0, textAlign: "right", marginRight: 12, fontSize: 12, color: "var(--text-muted)" }}>
        {fmtAge(req.createdAt)}
      </div>

      {/* Next deadline */}
      <div style={{ width: 80, flexShrink: 0, textAlign: "right", marginRight: 12 }}>
        {du !== null ? (
          <span style={{
            fontSize: 12, fontWeight: 500,
            color: du < 0 ? "var(--red)" : du <= 7 ? "var(--amber)" : "var(--text-second)",
          }}>
            {du < 0 ? `${Math.abs(du)}d over` : du === 0 ? "Today" : `${du}d`}
          </span>
        ) : (
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>
        )}
      </div>

      {/* Status */}
      <div style={{ width: 110, flexShrink: 0, marginRight: 12 }}>
        <Pill color={STATUS_COLOURS[req.sfStatus] || "grey"} style={{ fontSize: 10 }}>
          {req.sfStatus || "—"}
        </Pill>
      </div>

      {/* Flags */}
      <div style={{ width: 52, flexShrink: 0, display: "flex", gap: 4, marginRight: 12 }}>
        {flags.map(f => (
          <span key={f.key} title={f.label} style={{ fontSize: 14 }}>
            {f.key === "overdue" ? "🔴" : "🟡"}
          </span>
        ))}
      </div>

      {/* Score */}
      <div style={{ width: 96, flexShrink: 0 }}>
        <ScoreBar score={score} />
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tab }) {
  const label = tab === "all" ? "AC requests" : `${tab} requests`;
  return (
    <div style={{ padding: "48px 20px", textAlign: "center" }}>
      <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>No {label} found</p>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        Records sync from Salesforce via Workato. Run the seed script to add test data.
      </p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "all",        label: "All" },
  { id: "Technical",  label: "Technical" },
  { id: "Onboarding", label: "Onboarding" },
  { id: "TA Engagement", label: "TA Engagement" },
];

export default function ACManagerPage() {
  const [requests, setRequests]       = useState([]);
  const [milestoneMap, setMilestones] = useState({}); // sfId → milestones[]
  const [weights, setWeights]         = useState(DEFAULT_WEIGHTS);
  const [tab, setTab]                 = useState("all");
  const [selectedReq, setSelectedReq] = useState(null);
  const [loadingReqs, setLoadingReqs] = useState(true);
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [arrCeiling, setArrCeiling] = useState(DEFAULT_ARR_CEILING);
  const [flagFilter, setFlagFilter] = useState(null); // null | 'noaction' | 'escalated' | 'critical'

  // Live subscribe to acRequests
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "acRequests"),
      snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRequests(docs);
        setLoadingReqs(false);
        docs.forEach(req => {
          onSnapshot(
            collection(db, "acRequests", req.id, "milestones"),
            msSnap => {
              setMilestones(prev => ({
                ...prev,
                [req.id]: msSnap.docs.map(d => ({ id: d.id, ...d.data() })),
              }));
            },
            err => console.warn("Milestone fetch error:", req.id, err.message)
          );
        });
      },
      err => {
        console.error("acRequests snapshot error:", err.message);
        setLoadingReqs(false);
      }
    );
    return unsub;
  }, []);

  // Load ranking weights from acrSettings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "acrSettings", "config"), snap => {
      if (snap.exists()) {
        if (snap.data().rankingWeights) setWeights(snap.data().rankingWeights);
        if (snap.data().arrCeiling)    setArrCeiling(snap.data().arrCeiling);
      }
    });
    return unsub;
  }, []);

  // Filter + sort
  // Unique assignees for filter picker
  const assignees = [...new Set(
    requests.map(r => r.assignedTo).filter(Boolean)
  )].sort();

  const filtered = requests.filter(r => {
    if (tab !== "all" && r.requestType !== tab) return false;
    if (assignedFilter !== "all" && r.assignedTo !== assignedFilter) return false;
    if (flagFilter === "noaction") {
      const ms = milestoneMap[r.id] || [];
      const hasAction = ms.some(m => !m.completed && (m.date?.toDate ? m.date.toDate() : new Date(m.date)) > new Date());
      if (hasAction) return false;
    }
    if (flagFilter === "escalated" && (r.escalationMultiplier ?? 1) === 1) return false;
    if (flagFilter === "critical" && r.sfPriority !== "Critical") return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) =>
    calcScore(b, weights, arrCeiling) - calcScore(a, weights, arrCeiling)
  );

  // Stats for header
  const total    = requests.length;
  const critical = requests.filter(r => r.sfPriority === "Critical").length;
  const noAction = requests.filter(r => {
    const ms = milestoneMap[r.id] || [];
    return !ms.some(m => !m.completed && (m.date?.toDate ? m.date.toDate() : new Date(m.date)) > new Date());
  }).length;
  const escalated = requests.filter(r => (r.escalationMultiplier ?? 1) !== 1).length;

  // Derive live selected — after all hooks
  const liveSelected = selectedReq
    ? requests.find(r => r.id === selectedReq.id) ?? selectedReq
    : null;

  if (liveSelected) {
    return (
      <ACRequestPage
        req={liveSelected}
        milestones={milestoneMap[liveSelected.id] || []}
        weights={weights}
        arrCeiling={arrCeiling}
        onBack={() => setSelectedReq(null)}
      />
    );
  }

  return (
    <div style={{ padding: "24px 28px 48px", position: "relative" }}>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>
          AC Manager
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Account Collaboration Requests — EMEA CS&I · Synced from Salesforce
        </p>
      </div>

      {/* Stat cards — clickable to filter */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total requests", value: total,    colour: "var(--purple)", filter: null },
          { label: "Critical",       value: critical, colour: "var(--red)",    filter: "critical" },
          { label: "No next action", value: noAction, colour: "var(--amber)",  filter: "noaction" },
          { label: "Escalated",      value: escalated,colour: "var(--blue)",   filter: "escalated" },
        ].map(s => {
          const active = flagFilter === s.filter;
          return (
            <div key={s.label}
              onClick={() => setFlagFilter(active ? null : s.filter)}
              style={{
                background: active ? s.colour + "12" : "var(--surface)",
                border: `1px solid ${active ? s.colour : "var(--border)"}`,
                borderRadius: "var(--radius-lg)", padding: "14px 18px",
                boxShadow: "var(--shadow-sm)", cursor: s.filter ? "pointer" : "default",
                transition: "all 0.15s",
              }}
            >
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: active ? s.colour : "var(--text-muted)", marginBottom: 6 }}>
                {s.label}{active ? " ×" : ""}
              </p>
              <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 26, color: s.colour }}>
                {s.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 0 }}>
        {TABS.map(t => {
          const count = t.id === "all" ? requests.length : requests.filter(r => r.requestType === t.id).length;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "8px 16px", fontSize: 13, cursor: "pointer",
              background: "none", border: "none", fontFamily: "inherit",
              borderBottom: `2px solid ${active ? "var(--purple)" : "transparent"}`,
              color: active ? "var(--purple)" : "var(--text-second)",
              fontWeight: active ? 600 : 400,
              transition: "all 0.13s", display: "flex", alignItems: "center", gap: 6,
            }}>
              {t.label}
              <span style={{
                fontSize: 10, fontWeight: 700,
                background: active ? "var(--purple-light)" : "var(--surface2)",
                color: active ? "var(--purple)" : "var(--text-muted)",
                padding: "1px 6px", borderRadius: 999,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Assigned filter */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0 12px" }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)", flexShrink: 0 }}>Assigned to</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => setAssignedFilter("all")}
            style={{
              padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
              cursor: "pointer", border: "1px solid",
              background: assignedFilter === "all" ? "var(--purple-light)" : "transparent",
              borderColor: assignedFilter === "all" ? "var(--purple)" : "var(--border)",
              color: assignedFilter === "all" ? "var(--purple)" : "var(--text-muted)",
              fontFamily: "inherit", transition: "all 0.13s",
            }}
          >
            Everyone
          </button>
          {assignees.map(name => (
            <button
              key={name}
              onClick={() => setAssignedFilter(assignedFilter === name ? "all" : name)}
              style={{
                padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                background: assignedFilter === name ? "var(--purple-light)" : "transparent",
                borderColor: assignedFilter === name ? "var(--purple)" : "var(--border)",
                color: assignedFilter === name ? "var(--purple)" : "var(--text-muted)",
                fontFamily: "inherit", transition: "all 0.13s",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "none" }}>
        {/* Column headers */}
        <div style={{
          display: "flex", alignItems: "center", gap: 0,
          padding: "8px 18px",
          background: "var(--surface2)",
          borderBottom: "1px solid var(--border)",
        }}>
          <ColHead label="#"        width={32} />
          <div style={{ flex: 1, marginRight: 12 }}><ColHead label="Account" /></div>
          {tab === "all" && <ColHead label="Type"     width={110} style={{ marginRight: 12 }} />}
          <ColHead label="Assigned"  width={120} style={{ marginRight: 12 }} />
          <ColHead label="Priority"  width={80}  style={{ marginRight: 12 }} />
          <ColHead label="ARR"       width={70}  right style={{ marginRight: 12 }} />
          <ColHead label="Age"       width={40}  right style={{ marginRight: 12 }} />
          <ColHead label="Deadline"  width={80}  right style={{ marginRight: 12 }} />
          <ColHead label="Status"    width={110} style={{ marginRight: 12 }} />
          <ColHead label="Flags"     width={52}  style={{ marginRight: 12 }} />
          <ColHead label="Score"     width={96} />
        </div>

        {loadingReqs ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ width: 20, height: 20, border: "2px solid var(--border)", borderTopColor: "var(--purple)", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading requests...</p>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          sorted.map((req, i) => (
            <RequestRow
              key={req.id}
              req={req}
              rank={i + 1}
              milestones={milestoneMap[req.id]}
              weights={weights}
              arrCeiling={arrCeiling}
              tab={tab}
              onClick={() => setSelectedReq(req)}
            />
          ))
        )}
      </Card>

      {/* Footnote */}
      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
        Score = weighted combination of ARR, priority, deadline proximity, and work estimate × escalation multiplier.
        Adjust weights in Settings.
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

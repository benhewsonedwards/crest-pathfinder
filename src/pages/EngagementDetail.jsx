import { useState, useEffect } from "react";
import { doc, updateDoc, serverTimestamp, collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import {
  STAGES, STAGE_KEYS, RAG_STATUSES, TASK_TEMPLATES,
  buildDefaultTasks, fmtDate, fmtDateTime, stageColour, todayIso, workingDayAdd, diffDays
} from "../lib/constants";
import { Card, CardHeader, Label, Pill, Avatar, Btn, Tabs, Input, Select, Textarea, Modal, FieldGroup, Spinner } from "../components/UI";
import CapturePanel, { captureCompleteness } from "../components/CapturePanel";

// ─── Gantt chart ──────────────────────────────────────────────────────────────
function GanttChart({ stageTasks }) {
  const allTasks = [];
  STAGE_KEYS.forEach(sk => (stageTasks[sk] || []).forEach(t => allTasks.push({ ...t, stageKey: sk })));
  if (allTasks.length === 0) return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "20px 0" }}>No tasks defined yet. Add tasks to stages to see the Gantt.</p>;

  const allDates = allTasks.flatMap(t => [t.startDate, t.endDate]).filter(Boolean).sort();
  if (allDates.length === 0) return null;
  const minDate = new Date(allDates[0]);
  const maxDate = new Date(allDates[allDates.length - 1]);
  minDate.setDate(minDate.getDate() - 2);
  maxDate.setDate(maxDate.getDate() + 3);
  const totalDays = diffDays(minDate.toISOString().slice(0,10), maxDate.toISOString().slice(0,10));

  const ROW_H = 30, LABEL_W = 170, CHART_W = Math.max(totalDays * 14, 600);
  const SVG_W = LABEL_W + CHART_W + 20, SVG_H = allTasks.length * ROW_H + 44;

  function xPos(iso) { return LABEL_W + (diffDays(minDate.toISOString().slice(0,10), iso) / totalDays) * CHART_W; }

  const months = [];
  const cur = new Date(minDate);
  while (cur <= maxDate) {
    months.push({ label: cur.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }), x: xPos(cur.toISOString().slice(0,10)) });
    cur.setMonth(cur.getMonth() + 1); cur.setDate(1);
  }
  const todayX = xPos(todayIso());
  const showToday = todayX > LABEL_W && todayX < LABEL_W + CHART_W;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={SVG_W} height={SVG_H} style={{ display: "block", fontFamily: "Inter, sans-serif" }}>
        {allTasks.map((_, i) => <rect key={i} x={0} y={i*ROW_H+24} width={SVG_W} height={ROW_H} fill={i%2===0?"#F8F9FC":"#FFFFFF"}/>)}
        {months.map((m, i) => (
          <g key={i}>
            <line x1={m.x} y1={0} x2={m.x} y2={SVG_H} stroke="#E4E7EF" strokeWidth={1}/>
            <text x={m.x+4} y={14} fill="#9CA3AF" fontSize={9}>{m.label}</text>
          </g>
        ))}
        {showToday && (
          <g>
            <line x1={todayX} y1={0} x2={todayX} y2={SVG_H} stroke="#D97706" strokeWidth={1.5} strokeDasharray="4 3"/>
            <text x={todayX+3} y={14} fill="#D97706" fontSize={9} fontWeight="600">Today</text>
          </g>
        )}
        {allTasks.map((t, i) => {
          const colour = stageColour(t.stageKey);
          const x1 = xPos(t.startDate || todayIso());
          const x2 = xPos(t.endDate || workingDayAdd(t.startDate || todayIso(), 1));
          const barW = Math.max(x2 - x1, 6);
          const y = i*ROW_H+24+4, barH = ROW_H-8;
          return (
            <g key={i}>
              <text x={LABEL_W-8} y={y+barH/2+4} fill={t.done?"#9CA3AF":"#4B5563"} fontSize={10} textAnchor="end" dominantBaseline="middle">
                {t.title.length > 24 ? t.title.slice(0,22)+"…" : t.title}
              </text>
              <rect x={x1} y={y} width={barW} height={barH} rx={3} fill={t.done ? colour+"30" : colour+"60"}/>
              <rect x={x1} y={y} width={3} height={barH} rx={1} fill={colour}/>
              {t.done && <text x={x1+barW/2} y={y+barH/2+1} textAnchor="middle" dominantBaseline="middle" fill={colour} fontSize={9} fontWeight="700">✓</text>}
            </g>
          );
        })}
        {(() => {
          const groups = []; let last = null, si = 0;
          allTasks.forEach((t, i) => { if (t.stageKey !== last) { if (last) groups.push({ stageKey: last, si, ei: i-1 }); last = t.stageKey; si = i; } });
          if (last) groups.push({ stageKey: last, si, ei: allTasks.length-1 });
          return groups.map(g => {
            const c = stageColour(g.stageKey);
            return <rect key={g.stageKey} x={0} y={g.si*ROW_H+24} width={3} height={(g.ei-g.si+1)*ROW_H} fill={c} rx={1}/>;
          });
        })()}
      </svg>
    </div>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, onUpdate, onDelete, stageColour: sc, users }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "20px 1fr 130px 100px 100px 80px 28px",
      gap: 8, padding: "9px 16px", borderBottom: "1px solid var(--border)",
      alignItems: "center", opacity: task.done ? 0.6 : 1, transition: "opacity 0.15s",
    }}>
      <input type="checkbox" checked={task.done} onChange={e => onUpdate({ done: e.target.checked })}
        style={{ accentColor: sc, cursor: "pointer", width: 14, height: 14 }}/>
      <input value={task.title} onChange={e => onUpdate({ title: e.target.value })}
        style={{ fontSize: 12, padding: "4px 8px", border: "1px solid transparent", borderRadius: 6, background: "transparent", fontFamily: "inherit", width: "100%", outline: "none" }}
        onFocus={e => e.target.style.borderColor = "var(--border)"}
        onBlur={e => e.target.style.borderColor = "transparent"}
      />
      <Select value={task.ownerUid || ""} onChange={e => onUpdate({ ownerUid: e.target.value })} style={{ fontSize: 11, padding: "4px 8px" }}>
        <option value="">Unassigned</option>
        {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
      </Select>
      <input type="date" value={task.startDate || ""} onChange={e => onUpdate({ startDate: e.target.value })}
        style={{ fontSize: 11, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "inherit", outline: "none" }}/>
      <input type="date" value={task.endDate || ""} onChange={e => onUpdate({ endDate: e.target.value })}
        style={{ fontSize: 11, padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6, fontFamily: "inherit", outline: "none" }}/>
      <Pill color={task.done ? "green" : task.required ? "purple" : "grey"} style={{ fontSize: 10 }}>
        {task.done ? "Done" : task.required ? "Req" : "Opt"}
      </Pill>
      <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13, padding: 2 }}
        onMouseEnter={e => e.currentTarget.style.color = "var(--red)"}
        onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
      >✕</button>
    </div>
  );
}

// ─── Activity log ─────────────────────────────────────────────────────────────
function ActivityLog({ engagementId }) {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "engagements", engagementId, "activity"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [engagementId]);

  async function post() {
    if (!text.trim()) return;
    setPosting(true);
    await addDoc(collection(db, "engagements", engagementId, "activity"), {
      text: text.trim(), authorName: user.displayName, authorPhoto: user.photoURL,
      authorUid: user.uid, createdAt: serverTimestamp(),
    });
    setText("");
    setPosting(false);
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <Avatar name={user?.displayName} photoURL={user?.photoURL} size={30} style={{ flexShrink: 0, marginTop: 2 }}/>
        <div style={{ flex: 1 }}>
          <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="Add a note, update, or comment..." rows={2}/>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <Btn size="sm" onClick={post} disabled={!text.trim() || posting}>
              {posting ? "Posting..." : "Post update"}
            </Btn>
          </div>
        </div>
      </div>
      {entries.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>No activity yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {entries.map(e => (
            <div key={e.id} style={{ display: "flex", gap: 10 }}>
              <Avatar name={e.authorName} photoURL={e.authorPhoto} size={28} style={{ flexShrink: 0, marginTop: 2 }}/>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{e.authorName}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDateTime(e.createdAt)}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-second)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{e.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main engagement detail ───────────────────────────────────────────────────
export default function EngagementDetail({ engagement, onBack, users }) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [activeStage, setActiveStage] = useState(engagement.currentStage);
  const [saving, setSaving] = useState(false);

  const canEdit = ["super_admin", "admin", "cse", "csm", "com"].includes(profile?.role);

  async function save(updates) {
    setSaving(true);
    await updateDoc(doc(db, "engagements", engagement.id), { ...updates, updatedAt: serverTimestamp() });
    setSaving(false);
  }

  async function updateTask(stageKey, taskIdx, updates) {
    const tasks = [...(engagement.stageTasks?.[stageKey] || [])];
    tasks[taskIdx] = { ...tasks[taskIdx], ...updates };
    await save({ [`stageTasks.${stageKey}`]: tasks });
  }

  async function deleteTask(stageKey, taskIdx) {
    const tasks = (engagement.stageTasks?.[stageKey] || []).filter((_, i) => i !== taskIdx);
    await save({ [`stageTasks.${stageKey}`]: tasks });
  }

  async function addTask(stageKey) {
    const tasks = engagement.stageTasks?.[stageKey] || [];
    const lastEnd = tasks.length > 0 ? tasks[tasks.length - 1].endDate : todayIso();
    const newTask = {
      id: stageKey + "-" + Date.now(), title: "New task", ownerRole: null, ownerUid: null,
      startDate: workingDayAdd(lastEnd, 1), endDate: workingDayAdd(lastEnd, 3),
      required: false, done: false, notes: "",
    };
    await save({ [`stageTasks.${stageKey}`]: [...tasks, newTask] });
  }

  async function loadDefaults(stageKey) {
    await save({ [`stageTasks.${stageKey}`]: buildDefaultTasks(stageKey) });
  }

  async function advanceStage() {
    const idx = STAGE_KEYS.indexOf(engagement.currentStage);
    if (idx >= STAGE_KEYS.length - 1) return;
    const nextKey = STAGE_KEYS[idx + 1];
    const updates = { currentStage: nextKey };
    if (!(engagement.stageTasks?.[nextKey]?.length)) {
      updates[`stageTasks.${nextKey}`] = buildDefaultTasks(nextKey);
    }
    await save(updates);
    setActiveStage(nextKey);
  }

  const allTasks = STAGE_KEYS.flatMap(sk => engagement.stageTasks?.[sk] || []);
  const doneTasks = allTasks.filter(t => t.done).length;
  const totalPct = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0;
  const currentStageDef = STAGES.find(s => s.key === engagement.currentStage);
  const rag = RAG_STATUSES.find(r => r.key === engagement.ragStatus) || RAG_STATUSES[0];

  const stageTabs = STAGE_KEYS.map(sk => {
    const tasks = engagement.stageTasks?.[sk] || [];
    const done = tasks.filter(t => t.done).length;
    return { id: sk, label: STAGES.find(s=>s.key===sk)?.shortLabel, badge: tasks.length > 0 ? `${done}/${tasks.length}` : null };
  });

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      {/* Back + header */}
      <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, marginBottom: 14, display: "flex", alignItems: "center", gap: 5, padding: 0, fontFamily: "inherit" }}>
        ← All engagements
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 24 }}>{engagement.customer}</h1>
            <Pill color={rag.key === "green" ? "green" : rag.key === "red" ? "red" : "amber"}>
              {rag.emoji} {rag.label}
            </Pill>
            {saving && <Spinner size={14} />}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {[engagement.csId, engagement.region, engagement.segment, engagement.tshirt].filter(Boolean).join(" · ")}
            {engagement.arr && ` · £${Number(engagement.arr).toLocaleString()}`}
          </p>
        </div>
        {canEdit && STAGE_KEYS.indexOf(engagement.currentStage) < STAGE_KEYS.length - 1 && (
          <Btn variant="success" onClick={advanceStage}>
            Advance → {STAGES[STAGE_KEYS.indexOf(engagement.currentStage) + 1]?.shortLabel}
          </Btn>
        )}
      </div>

      {/* Stage pipeline */}
      <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 16, boxShadow: "var(--shadow-sm)" }}>
        {STAGES.map((s, i) => {
          const isCurrent = s.key === engagement.currentStage;
          const isPast = STAGE_KEYS.indexOf(s.key) < STAGE_KEYS.indexOf(engagement.currentStage);
          const tasks = engagement.stageTasks?.[s.key] || [];
          const prog = tasks.length > 0 ? Math.round((tasks.filter(t=>t.done).length/tasks.length)*100) : 0;
          return (
            <div key={s.key} onClick={() => { setActiveStage(s.key); setActiveTab("tasks"); }}
              style={{
                flex: 1, padding: "10px 6px", textAlign: "center", cursor: "pointer",
                background: isCurrent ? s.colour + "12" : isPast ? s.colour + "06" : "transparent",
                borderRight: i < STAGES.length - 1 ? "1px solid var(--border)" : "none",
                transition: "background 0.13s",
                outline: activeStage === s.key && activeTab === "tasks" ? `2px solid ${s.colour}40` : "none",
                outlineOffset: -1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                <span style={{ fontSize: 12 }}>{s.icon}</span>
                <span style={{ fontSize: 9, fontWeight: isCurrent ? 700 : 500, color: isCurrent ? s.colour : isPast ? "var(--text-muted)" : "var(--text-second)" }}>
                  {s.shortLabel}
                </span>
                {isPast && tasks.length > 0 && prog === 100 && <span style={{ fontSize: 9, color: "var(--green)" }}>✓</span>}
              </div>
              {tasks.length > 0 && (
                <div style={{ height: 2, borderRadius: 99, background: "var(--border)", margin: "4px 4px 0", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${prog}%`, background: isPast && prog===100 ? "var(--green)" : s.colour, borderRadius: 99 }}/>
                </div>
              )}
              {isCurrent && <span style={{ fontSize: 8, color: s.colour, fontWeight: 700, display: "block", marginTop: 2 }}>ACTIVE</span>}
            </div>
          );
        })}
      </div>

      {/* Overall progress */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Overall progress</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: totalPct === 100 ? "var(--green)" : "var(--text-second)" }}>{doneTasks}/{allTasks.length} tasks</span>
          </div>
          <div style={{ height: 5, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${totalPct}%`, background: totalPct===100 ? "var(--green)" : "linear-gradient(90deg, var(--purple), var(--blue))", borderRadius: 99, transition: "width 0.4s" }}/>
          </div>
        </div>
      </div>

      {/* Top tabs */}
      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "tasks", label: "Tasks" },
          { id: "gantt", label: "Gantt" },
          { id: "activity", label: "Activity" },
        ]}
        active={activeTab}
        onChange={setActiveTab}
        style={{ marginBottom: 18 }}
      />

      {/* ── OVERVIEW ── */}
      {activeTab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Left: key info */}
          <div>
            <Card style={{ marginBottom: 12 }}>
              <CardHeader><Label>Engagement details</Label></CardHeader>
              <div style={{ padding: "14px 18px" }}>
                {[
                  ["Customer", engagement.customer],
                  ["CS Request ID", engagement.csId],
                  ["SF Opportunity ID", engagement.sfOppId],
                  ["Region", engagement.region],
                  ["Segment", engagement.segment],
                  ["Subscription", engagement.subscription],
                  ["Opportunity type", engagement.oppType],
                  ["T-shirt size", engagement.tshirt],
                  ["ARR", engagement.arr ? `£${Number(engagement.arr).toLocaleString()}` : null],
                  ["Currency", engagement.currency],
                  ["Plan type", engagement.planType],
                  ["Close date", engagement.closeDate ? fmtDate(engagement.closeDate) : null],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* SC Modules & Integrations */}
            {((engagement.modules?.length > 0) || (engagement.integrations?.length > 0)) && (
              <Card>
                <CardHeader><Label>Solution scope</Label></CardHeader>
                <div style={{ padding: "12px 18px" }}>
                  {engagement.modules?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <Label style={{ marginBottom: 6, display: "block" }}>SC Modules</Label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {engagement.modules.map(m => <Pill key={m} color="purple" style={{ fontSize: 10 }}>{m}</Pill>)}
                      </div>
                    </div>
                  )}
                  {engagement.integrations?.length > 0 && (
                    <div>
                      <Label style={{ marginBottom: 6, display: "block" }}>Integrations</Label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {engagement.integrations.map(i => <Pill key={i} color="blue" style={{ fontSize: 10 }}>{i}</Pill>)}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Right: people + stage summary */}
          <div>
            <Card style={{ marginBottom: 12 }}>
              <CardHeader><Label>Team</Label></CardHeader>
              <div style={{ padding: "12px 18px" }}>
                {[["AE", engagement.aeUid], ["CSE", engagement.cseUid], ["CSM", engagement.csmUid], ["TA", engagement.taUid]].map(([role, uid]) => {
                  const u = users.find(u => u.uid === uid);
                  if (!u) return null;
                  return (
                    <div key={role} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <Avatar name={u.displayName} photoURL={u.photoURL} size={28}/>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500 }}>{u.displayName}</p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{role}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card>
              <CardHeader><Label>Stage summary</Label></CardHeader>
              <div>
                {STAGES.map((s, i) => {
                  const tasks = engagement.stageTasks?.[s.key] || [];
                  const done = tasks.filter(t=>t.done).length;
                  const isCurrent = s.key === engagement.currentStage;
                  const isPast = STAGE_KEYS.indexOf(s.key) < STAGE_KEYS.indexOf(engagement.currentStage);
                  return (
                    <div key={s.key} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "9px 18px",
                      borderBottom: i < STAGES.length-1 ? "1px solid var(--border)" : "none",
                      opacity: !isCurrent && !isPast ? 0.45 : 1,
                      cursor: "pointer",
                    }} onClick={() => { setActiveStage(s.key); setActiveTab("tasks"); }}>
                      <span style={{ fontSize: 14 }}>{s.icon}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12, color: isCurrent ? s.colour : "var(--text-primary)", fontWeight: isCurrent ? 600 : 400 }}>{s.label}</span>
                        {isCurrent && <span style={{ marginLeft: 6, fontSize: 9, background: s.colour+"15", color: s.colour, padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>ACTIVE</span>}
                        {isPast && tasks.length > 0 && done === tasks.length && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--green)" }}>✓</span>}
                      </div>
                      {tasks.length > 0 && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{done}/{tasks.length}</span>}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Notes */}
          {engagement.notes && (
            <div style={{ gridColumn: "1 / -1" }}>
              <Card>
                <CardHeader><Label>Notes</Label></CardHeader>
                <p style={{ padding: "14px 18px", fontSize: 13, color: "var(--text-second)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{engagement.notes}</p>
              </Card>
            </div>
          )}
        </div>
      )}

      {activeTab === "tasks" && (
        <div>
          {/* Stage selector */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {STAGES.map(s => {
              const tasks = engagement.stageTasks?.[s.key] || [];
              const done = tasks.filter(t=>t.done).length;
              const capComp = captureCompleteness(s.key, (engagement.stageCapture||{})[s.key] || {});
              const hasCritGap = capComp && capComp.criticalPct < 100;
              const isActive = activeStage === s.key;
              return (
                <button key={s.key} onClick={() => setActiveStage(s.key)} style={{
                  padding: "5px 12px", borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer",
                  border: `1px solid ${isActive ? s.colour : "var(--border)"}`,
                  background: isActive ? s.colour + "12" : "var(--surface)",
                  color: isActive ? s.colour : "var(--text-second)", fontWeight: isActive ? 600 : 400,
                  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
                }}>
                  <span>{s.icon}</span> {s.shortLabel}
                  {tasks.length > 0 && <span style={{ fontSize: 10, background: isActive ? s.colour+"20" : "var(--surface2)", color: isActive ? s.colour : "var(--text-muted)", padding: "0 4px", borderRadius: 4 }}>{done}/{tasks.length}</span>}
                  {hasCritGap && <span style={{ color: "var(--amber)", fontSize: 10 }}>⚠</span>}
                </button>
              );
            })}
          </div>

          {/* Sub-tabs: Tasks / Capture */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 16, gap: 0 }}>
            {[["tasks", "Tasks"], ["capture", "Data Capture"]].map(([id, label]) => {
              const capComp = id === "capture" ? captureCompleteness(activeStage, (engagement.stageCapture||{})[activeStage]||{}) : null;
              return (
                <button key={id} onClick={() => setStageSubTab(id)} style={{
                  padding: "7px 14px", fontSize: 13, cursor: "pointer", background: "none",
                  border: "none", borderBottom: `2px solid ${stageSubTab===id?"var(--purple)":"transparent"}`,
                  color: stageSubTab===id?"var(--purple)":"var(--text-second)", fontWeight: stageSubTab===id?600:400,
                  fontFamily: "inherit", marginBottom: -1, display: "flex", alignItems: "center", gap: 6,
                }}>
                  {label}
                  {capComp && (
                    <span style={{ fontSize: 9, background: capComp.criticalPct===100?"var(--green-light)":"var(--amber-light)", color: capComp.criticalPct===100?"var(--green)":"var(--amber)", padding: "1px 5px", borderRadius: 999, fontWeight: 700 }}>
                      {capComp.criticalDone}/{capComp.critical}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {stageSubTab === "tasks" && (
            <Card>
              {(() => {
                const stage = STAGES.find(s => s.key === activeStage);
                const tasks = engagement.stageTasks?.[activeStage] || [];
                return (
                  <div>
                    <CardHeader>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>{stage?.icon}</span>
                        <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: stage?.colour }}>{stage?.label}</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{stage?.description}</span>
                      </div>
                      {canEdit && (
                        <div style={{ display: "flex", gap: 6 }}>
                          {tasks.length === 0 && <Btn size="sm" variant="ghost" onClick={() => loadDefaults(activeStage)}>Load defaults</Btn>}
                          <Btn size="sm" variant="ghost" onClick={() => addTask(activeStage)}>+ Add task</Btn>
                        </div>
                      )}
                    </CardHeader>
                    {tasks.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "24px 0" }}>
                        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>No tasks yet for this stage</p>
                        {canEdit && <Btn size="sm" onClick={() => loadDefaults(activeStage)}>Load default tasks</Btn>}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 130px 100px 100px 80px 28px", gap: 8, padding: "7px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                          {["✓", "Task", "Owner", "Start", "End", "Status", ""].map(h => <Label key={h}>{h}</Label>)}
                        </div>
                        {tasks.map((task, i) => (
                          <TaskRow key={task.id || i} task={task}
                            onUpdate={updates => canEdit && updateTask(activeStage, i, updates)}
                            onDelete={() => canEdit && deleteTask(activeStage, i)}
                            stageColour={stage?.colour} users={users}
                          />
                        ))}
                      </>
                    )}
                  </div>
                );
              })()}
            </Card>
          )}

          {stageSubTab === "capture" && (
            <CapturePanel
              engagementId={engagement.id}
              stageKey={activeStage}
              captureData={(engagement.stageCapture||{})[activeStage] || {}}
              allStageCapture={engagement.stageCapture || {}}
              canEdit={canEdit}
            />
          )}
        </div>
      )}

      {/* ── GANTT ── */}
      {activeTab === "gantt" && (
        <Card style={{ padding: 20 }}>
          <GanttChart stageTasks={engagement.stageTasks || {}} />
        </Card>
      )}

      {/* ── ACTIVITY ── */}
      {activeTab === "activity" && (
        <Card style={{ padding: 20 }}>
          <ActivityLog engagementId={engagement.id} />
        </Card>
      )}
    </div>
  );
}

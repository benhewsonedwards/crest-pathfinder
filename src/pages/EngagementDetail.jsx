import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { doc, updateDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import {
  STAGES, STAGE_KEYS, RAG_STATUSES, TASK_TEMPLATES,
  buildDefaultTasks, buildAllStageTasks, rippleTasks, rippleAllStages, stageEndDate,
  fmtDate, fmtDateTime, stageColour, todayIso, workingDayAdd, diffDays
} from "../lib/constants";
import { Card, CardHeader, Label, Pill, Avatar, Btn, Tabs, Input, Select, Textarea, Modal, FieldGroup, Spinner } from "../components/UI";
import CapturePanel, { captureCompleteness } from "../components/CapturePanel";

// ─── Interactive Gantt chart ──────────────────────────────────────────────────
// Performance: drag updates go directly to the SVG DOM — no React re-renders per frame.
// React only re-renders on drag-end (to commit the final state).
function GanttChart({ stageTasks, onUpdateTask, canEdit }) {
  const containerRef = React.useRef(null);
  const svgRef       = React.useRef(null);
  const S            = React.useRef({});   // all mutable drag state lives here
  const [, forceUpdate] = React.useReducer(n => n + 1, 0);

  // ── Build flat task list ───────────────────────────────────────────────────
  const propTasks = React.useMemo(() => {
    const out = [];
    STAGE_KEYS.forEach(sk => (stageTasks[sk] || []).forEach(t => out.push({ ...t, stageKey: sk })));
    return out;
  }, [stageTasks]);

  // Keep refs fresh without triggering re-renders
  S.current.propTasks    = propTasks;
  S.current.onUpdateTask = onUpdateTask;
  S.current.canEdit      = canEdit;

  // ── Layout — compute once per prop change, not per render ─────────────────
  const layout = React.useMemo(() => {
    const dates = propTasks.flatMap(t => [t.startDate, t.endDate]).filter(Boolean).sort();
    if (!dates.length) return null;
    const mn = new Date(dates[0]);
    const mx = new Date(dates[dates.length - 1]);
    mn.setDate(mn.getDate() - 3);
    mx.setDate(mx.getDate() + 8);
    const LABEL_W = 170;
    const CHART_W = Math.max(Math.round((mx - mn) / 86400000) * 14, 600);
    const totalMs = mx.getTime() - mn.getTime();
    return {
      minMs:     mn.getTime(),
      maxDate:   mx,
      LABEL_W,
      CHART_W,
      ROW_H:     30,
      HANDLE_W:  8,
      SVG_W:     LABEL_W + CHART_W + 20,
      PX_PER_MS: CHART_W / totalMs,
      MS_PER_PX: totalMs / CHART_W,
      totalMs,
    };
  }, [propTasks]);

  // Keep layout in ref for drag handlers
  S.current.layout = layout;

  if (!layout || propTasks.length === 0) return (
    <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "20px 0" }}>
      No tasks defined yet. Add tasks to stages to see the Gantt.
    </p>
  );

  const { minMs, maxDate, LABEL_W, CHART_W, ROW_H, HANDLE_W, SVG_W, PX_PER_MS, MS_PER_PX } = layout;
  const SVG_H = propTasks.length * ROW_H + 44;

  // ── Coord helpers (pure, stable) ───────────────────────────────────────────
  function isoToX(iso) {
    if (!iso) return LABEL_W;
    return LABEL_W + (new Date(iso).getTime() - minMs) * PX_PER_MS;
  }

  function msToWorkingIso(ms) {
    const d = new Date(ms);
    const dow = d.getDay();
    if (dow === 6) d.setDate(d.getDate() - 1);
    if (dow === 0) d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function getEventX(e) {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) + el.scrollLeft;
  }

  // ── Direct DOM bar update — called on every mousemove, no React re-render ──
  function updateBarDOM(taskIdx, newStart, newEnd) {
    const svg = svgRef.current;
    if (!svg) return;
    const L = S.current.layout;
    const x1   = LABEL_W + (new Date(newStart).getTime() - L.minMs) * L.PX_PER_MS;
    const x2   = LABEL_W + (new Date(newEnd).getTime()   - L.minMs) * L.PX_PER_MS;
    const barW = Math.max(x2 - x1, 4);
    const hW   = Math.min(L.HANDLE_W, Math.floor(barW / 2));

    const bar     = svg.querySelector(`[data-bar="${taskIdx}"]`);
    const shadow  = svg.querySelector(`[data-shadow="${taskIdx}"]`);
    const lHandle = svg.querySelector(`[data-lhandle="${taskIdx}"]`);
    const rHandle = svg.querySelector(`[data-rhandle="${taskIdx}"]`);
    const tip     = svg.querySelector(`[data-tooltip]`);

    if (bar)     { bar.setAttribute("x", x1); bar.setAttribute("width", barW); }
    if (shadow)  { shadow.setAttribute("x", x1+2); shadow.setAttribute("width", barW); }
    if (lHandle) { lHandle.setAttribute("x", x1); lHandle.setAttribute("width", hW); }
    if (rHandle) { rHandle.setAttribute("x", x1+barW-hW); rHandle.setAttribute("width", hW); }

    if (tip) {
      const cx = Math.min(Math.max((x1+x2)/2, LABEL_W+68), L.SVG_W-68);
      const tipBg   = tip.querySelector("rect");
      const tipText = tip.querySelector("text");
      if (tipBg)   tipBg.setAttribute("x", cx-64);
      if (tipText) { tipText.setAttribute("x", cx); tipText.textContent = `${fmtDate(newStart)} → ${fmtDate(newEnd)}`; }
      // Show tooltip
      tip.style.display = "";
    }
  }

  // ── One-time drag handlers ─────────────────────────────────────────────────
  if (!S.current.handlers) {
    S.current.handlers = true;

    S.current.onMove = function(e) {
      const drag = S.current.drag;
      if (!drag) return;
      if (e.cancelable) e.preventDefault();

      const L         = S.current.layout;
      const mouseX    = getEventX(e);
      const cursorMs  = L.minMs + (mouseX - L.LABEL_W) * L.MS_PER_PX;
      const { mode, origStart, origEnd, durMs, grabOffsetMs } = drag;

      let newStart = origStart, newEnd = origEnd;

      if (mode === "move") {
        newStart = msToWorkingIso(cursorMs - grabOffsetMs);
        const endMs = new Date(newStart).getTime() + durMs;
        const de = new Date(endMs);
        if (de.getDay() === 6) de.setDate(de.getDate() + 2);
        if (de.getDay() === 0) de.setDate(de.getDate() + 1);
        newEnd = de.toISOString().slice(0, 10);
      } else if (mode === "left") {
        const c = msToWorkingIso(cursorMs);
        if (c < origEnd) newStart = c;
      } else {
        const de = new Date(cursorMs);
        if (de.getDay() === 6) de.setDate(de.getDate() + 2);
        if (de.getDay() === 0) de.setDate(de.getDate() + 1);
        const c = de.toISOString().slice(0, 10);
        if (c > origStart) newEnd = c;
      }

      drag.currentStart = newStart;
      drag.currentEnd   = newEnd;
      updateBarDOM(drag.taskIdx, newStart, newEnd);
    };

    S.current.onUp = function() {
      window.removeEventListener("mousemove", S.current.onMove);
      window.removeEventListener("mouseup",   S.current.onUp);
      window.removeEventListener("touchmove", S.current.onMove);
      window.removeEventListener("touchend",  S.current.onUp);

      // Hide tooltip
      const svg = svgRef.current;
      if (svg) {
        const tip = svg.querySelector("[data-tooltip]");
        if (tip) tip.style.display = "none";
        // Reset active bar fill
        const drag = S.current.drag;
        if (drag) {
          const bar = svg.querySelector(`[data-bar="${drag.taskIdx}"]`);
          if (bar) bar.setAttribute("fill", S.current.propTasks[drag.taskIdx] ? stageColour(S.current.propTasks[drag.taskIdx].stageKey) + "70" : "");
        }
      }

      const drag = S.current.drag;
      S.current.drag = null;
      if (!drag) { forceUpdate(); return; }

      const { taskIdx, currentStart, currentEnd, origStart, origEnd } = drag;
      const original = S.current.propTasks[taskIdx];

      if (!original || (currentStart === origStart && currentEnd === origEnd)) {
        forceUpdate(); return;
      }

      // Commit to Firestore — React re-render happens when prop comes back
      S.current.onUpdateTask(original.stageKey, original.id, {
        startDate: currentStart,
        endDate:   currentEnd,
      });
      // forceUpdate will happen when stageTasks prop changes
    };
  }

  S.current.getEventX = getEventX;

  function onPointerDown(e, taskIdx, mode) {
    if (!S.current.canEdit) return;
    const t = S.current.propTasks[taskIdx];
    if (!t || t.done || t.locked) return;
    e.preventDefault();
    e.stopPropagation();

    const L          = S.current.layout;
    const mouseX     = getEventX(e);
    const startX     = LABEL_W + (new Date(t.startDate).getTime() - L.minMs) * L.PX_PER_MS;
    const durMs      = new Date(t.endDate).getTime() - new Date(t.startDate).getTime();
    const grabOffsetMs = (mouseX - startX) * L.MS_PER_PX;

    S.current.drag = {
      taskIdx, mode,
      origStart: t.startDate, origEnd: t.endDate,
      currentStart: t.startDate, currentEnd: t.endDate,
      durMs, grabOffsetMs,
    };

    // Visually mark as active
    const svg = svgRef.current;
    if (svg) {
      const bar = svg.querySelector(`[data-bar="${taskIdx}"]`);
      if (bar) bar.setAttribute("fill", stageColour(t.stageKey) + "BB");
    }

    window.addEventListener("mousemove", S.current.onMove);
    window.addEventListener("mouseup",   S.current.onUp);
    window.addEventListener("touchmove", S.current.onMove, { passive: false });
    window.addEventListener("touchend",  S.current.onUp);
  }

  // ── Month labels ───────────────────────────────────────────────────────────
  const months = React.useMemo(() => {
    if (!layout) return [];
    const out = [];
    const cur = new Date(minMs);
    while (cur <= maxDate) {
      out.push({
        label: cur.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        x:     LABEL_W + (cur.getTime() - minMs) * PX_PER_MS,
      });
      cur.setMonth(cur.getMonth() + 1);
      cur.setDate(1);
    }
    return out;
  }, [layout]);

  const todayX    = LABEL_W + (Date.now() - minMs) * PX_PER_MS;
  const showToday = todayX > LABEL_W && todayX < LABEL_W + CHART_W;

  // Stage sidebar groups
  const stageGroups = React.useMemo(() => {
    const groups = []; let last = null, si = 0;
    propTasks.forEach((t, i) => {
      if (t.stageKey !== last) {
        if (last) groups.push({ key: last, si, ei: i - 1 });
        last = t.stageKey; si = i;
      }
    });
    if (last) groups.push({ key: last, si, ei: propTasks.length - 1 });
    return groups;
  }, [propTasks]);

  return (
    <div ref={containerRef} style={{ overflowX: "auto", userSelect: "none" }}>
      <svg ref={svgRef} width={SVG_W} height={SVG_H}
        style={{ display: "block", fontFamily: "Inter, sans-serif", touchAction: "none" }}>

        {/* Row backgrounds */}
        {propTasks.map((_, i) => (
          <rect key={i} x={0} y={i*ROW_H+24} width={SVG_W} height={ROW_H}
            fill={i%2===0?"#F8F9FC":"#FFFFFF"} />
        ))}

        {/* Month gridlines */}
        {months.map((m, i) => (
          <g key={i}>
            <line x1={m.x} y1={0} x2={m.x} y2={SVG_H} stroke="#E4E7EF" strokeWidth={1}/>
            <text x={m.x+4} y={14} fill="#9CA3AF" fontSize={9}>{m.label}</text>
          </g>
        ))}

        {/* Today line */}
        {showToday && (
          <g>
            <line x1={todayX} y1={0} x2={todayX} y2={SVG_H}
              stroke="#D97706" strokeWidth={1.5} strokeDasharray="4 3"/>
            <text x={todayX+3} y={14} fill="#D97706" fontSize={9} fontWeight="600">Today</text>
          </g>
        )}

        {/* Bars */}
        {propTasks.map((t, i) => {
          const colour  = stageColour(t.stageKey);
          const x1      = isoToX(t.startDate || todayIso());
          const x2      = isoToX(t.endDate   || workingDayAdd(t.startDate || todayIso(), 1));
          const barW    = Math.max(x2 - x1, 4);
          const y       = i * ROW_H + 24 + 4;
          const barH    = ROW_H - 8;
          const movable = canEdit && !t.done && !t.locked;
          const hW      = Math.min(HANDLE_W, Math.floor(barW / 2));

          return (
            <g key={t.id || i}>
              <text x={LABEL_W-8} y={y+barH/2+4}
                fill={t.done ? "#9CA3AF" : "#374151"} fontSize={10}
                textAnchor="end" dominantBaseline="middle">
                {t.title.length > 24 ? t.title.slice(0,22)+"…" : t.title}
              </text>

              {/* Shadow — shown during drag via data-shadow attr */}
              <rect data-shadow={i} x={x1+2} y={y+2} width={barW} height={barH} rx={3}
                fill="rgba(0,0,0,0.12)" style={{ pointerEvents:"none", display:"none" }}/>

              {/* Bar */}
              <rect data-bar={i} x={x1} y={y} width={barW} height={barH} rx={3}
                fill={t.done ? colour+"28" : t.locked ? colour+"44" : colour+"70"}
                stroke={t.locked ? colour : "none"} strokeWidth={t.locked ? 1.5 : 0}
                strokeDasharray={t.locked ? "5 2" : "none"}
                style={{ cursor: movable ? "grab" : "default" }}
                onMouseDown={ev => onPointerDown(ev, i, "move")}
                onTouchStart={ev => onPointerDown(ev, i, "move")}
              />

              <rect x={x1} y={y} width={3} height={barH} rx={1} fill={colour}
                style={{ pointerEvents:"none" }}/>

              {t.done && (
                <text x={x1+barW/2} y={y+barH/2+1} textAnchor="middle"
                  dominantBaseline="middle" fill={colour} fontSize={9} fontWeight="700"
                  style={{ pointerEvents:"none" }}>✓</text>
              )}
              {t.locked && !t.done && (
                <text x={x1+barW-7} y={y+barH/2+1} textAnchor="middle"
                  dominantBaseline="middle" fontSize={8}
                  style={{ pointerEvents:"none" }}>🔒</text>
              )}

              {movable && (
                <>
                  <rect data-lhandle={i} x={x1} y={y} width={hW} height={barH} rx={2}
                    fill={colour} opacity={0.9} style={{ cursor:"ew-resize" }}
                    onMouseDown={ev => { ev.stopPropagation(); onPointerDown(ev, i, "left"); }}
                    onTouchStart={ev => { ev.stopPropagation(); onPointerDown(ev, i, "left"); }}
                  />
                  <rect data-rhandle={i} x={x1+barW-hW} y={y} width={hW} height={barH} rx={2}
                    fill={colour} opacity={0.9} style={{ cursor:"ew-resize" }}
                    onMouseDown={ev => { ev.stopPropagation(); onPointerDown(ev, i, "right"); }}
                    onTouchStart={ev => { ev.stopPropagation(); onPointerDown(ev, i, "right"); }}
                  />
                </>
              )}
            </g>
          );
        })}

        {/* Stage colour sidebar */}
        {stageGroups.map(g => (
          <rect key={g.key} x={0} y={g.si*ROW_H+24} width={3}
            height={(g.ei-g.si+1)*ROW_H} fill={stageColour(g.key)} rx={1}
            style={{ pointerEvents:"none" }}/>
        ))}

        {/* Tooltip — hidden until drag, updated directly via DOM */}
        <g data-tooltip style={{ pointerEvents:"none", display:"none" }}>
          <rect x={0} y={0} width={128} height={18} rx={4} fill="#111827" opacity={0.9}/>
          <text x={64} y={11} textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={10} fontWeight={600}>—</text>
        </g>
      </svg>

      {canEdit && (
        <p style={{ fontSize: 10, color:"var(--text-muted)", marginTop:6, paddingLeft:4 }}>
          Drag bars to move · drag edges to resize · click 🔓 on a task to pin its dates
        </p>
      )}
    </div>
  );
}


// ─── Task row ─────────────────────────────────────────────────────────────────
function TaskRow({ task, onUpdate, onDelete, stageColour: sc, users }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "20px 1fr 130px 100px 100px 56px 28px 28px",
      gap: 8, padding: "9px 16px", borderBottom: "1px solid var(--border)",
      alignItems: "center", opacity: task.done ? 0.6 : 1, transition: "opacity 0.15s",
      background: task.locked ? "rgba(101,89,255,0.03)" : "transparent",
    }}>
      <input type="checkbox" checked={task.done} onChange={e => onUpdate({ done: e.target.checked })}
        style={{ accentColor: sc, cursor: "pointer", width: 14, height: 14 }}/>
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        {task.locked && (
          <span title="Date locked — won't move with ripple" style={{ fontSize: 11, flexShrink: 0 }}>🔒</span>
        )}
        <input value={task.title} onChange={e => onUpdate({ title: e.target.value })}
          style={{ fontSize: 12, padding: "4px 8px", border: "1px solid transparent", borderRadius: 6, background: "transparent", fontFamily: "inherit", width: "100%", outline: "none", minWidth: 0 }}
          onFocus={e => e.target.style.borderColor = "var(--border)"}
          onBlur={e => e.target.style.borderColor = "transparent"}
        />
      </div>
      <Select value={task.ownerUid || ""} onChange={e => onUpdate({ ownerUid: e.target.value })} style={{ fontSize: 11, padding: "4px 8px" }}>
        <option value="">Unassigned</option>
        {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
      </Select>
      <input type="date" value={task.startDate || ""} onChange={e => onUpdate({ startDate: e.target.value })}
        style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${task.locked ? "var(--purple)" : "var(--border)"}`, borderRadius: 6, fontFamily: "inherit", outline: "none" }}/>
      <input type="date" value={task.endDate || ""} onChange={e => onUpdate({ endDate: e.target.value })}
        style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${task.locked ? "var(--purple)" : "var(--border)"}`, borderRadius: 6, fontFamily: "inherit", outline: "none" }}/>
      <Pill color={task.done ? "green" : task.required ? "purple" : "grey"} style={{ fontSize: 10 }}>
        {task.done ? "Done" : task.required ? "Req" : "Opt"}
      </Pill>
      {/* Lock / unlock button */}
      <button
        onClick={() => onUpdate({ locked: !task.locked })}
        title={task.locked ? "Unlock — allow ripple to move this task" : "Lock — fix this date, ripple won't move it"}
        style={{ background: task.locked ? "var(--purple-light)" : "none", border: "none", cursor: "pointer", fontSize: 13, padding: 2, borderRadius: 4, color: task.locked ? "var(--purple)" : "var(--text-muted)" }}
        onMouseEnter={e => { if (!task.locked) e.currentTarget.style.color = "var(--purple)"; }}
        onMouseLeave={e => { if (!task.locked) e.currentTarget.style.color = "var(--text-muted)"; }}
      >{task.locked ? "🔒" : "🔓"}</button>
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
export default function EngagementDetail({ engagement, onBack, users, onOpenCustomer, customers = [] }) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [activeStage, setActiveStage] = useState(engagement.currentStage);
  const [stageSubTab, setStageSubTab] = useState("tasks");
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLinkCustomer, setShowLinkCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const canEdit = ["super_admin", "admin", "cse", "csm", "com"].includes(profile?.role);

  async function save(updates) {
    setSaving(true);
    await updateDoc(doc(db, "engagements", engagement.id), { ...updates, updatedAt: serverTimestamp() });
    setSaving(false);
  }

  async function updateTask(stageKey, taskIdx, updates) {
    const tasks = [...(engagement.stageTasks?.[stageKey] || [])];
    tasks[taskIdx] = { ...tasks[taskIdx], ...updates };

    // If a date changed, ripple within the stage and then forward across all stages
    const dateChanged = "startDate" in updates || "endDate" in updates || "done" in updates;
    if (dateChanged) {
      const rippled = rippleAllStages(
        { ...engagement.stageTasks, [stageKey]: rippleTasks(tasks) },
        stageKey
      );
      // Build a flat Firestore update for all affected stages
      const firestoreUpdates = {};
      STAGE_KEYS.forEach(sk => {
        if (rippled[sk] && engagement.stageTasks?.[sk]) {
          firestoreUpdates[`stageTasks.${sk}`] = rippled[sk];
        }
      });
      await save(firestoreUpdates);
    } else {
      await save({ [`stageTasks.${stageKey}`]: tasks });
    }
  }

  async function deleteTask(stageKey, taskIdx) {
    const tasks = (engagement.stageTasks?.[stageKey] || []).filter((_, i) => i !== taskIdx);
    const rippled = rippleAllStages({ ...engagement.stageTasks, [stageKey]: tasks }, stageKey);
    const firestoreUpdates = {};
    STAGE_KEYS.forEach(sk => { firestoreUpdates[`stageTasks.${sk}`] = rippled[sk] || []; });
    await save(firestoreUpdates);
  }

  async function addTask(stageKey) {
    const tasks = engagement.stageTasks?.[stageKey] || [];
    const lastEnd = stageEndDate(tasks) || todayIso();
    const newTask = {
      id: stageKey + "-" + Date.now(), title: "New task",
      owner: null, ownerRole: null, ownerUid: null,
      startDate: workingDayAdd(lastEnd, 1), endDate: workingDayAdd(lastEnd, 3),
      required: false, done: false, notes: "",
    };
    await save({ [`stageTasks.${stageKey}`]: [...tasks, newTask] });
  }

  async function loadDefaults(stageKey) {
    // Reload this stage's defaults starting from where the previous stage ended
    const prevKey = STAGE_KEYS[STAGE_KEYS.indexOf(stageKey) - 1];
    const prevEnd = prevKey ? stageEndDate(engagement.stageTasks?.[prevKey] || []) : null;
    const startDate = prevEnd ? workingDayAdd(prevEnd, 1) : todayIso();
    const newTasks = buildDefaultTasks(stageKey, startDate);
    const rippled = rippleAllStages({ ...engagement.stageTasks, [stageKey]: newTasks }, stageKey);
    const firestoreUpdates = {};
    STAGE_KEYS.forEach(sk => { firestoreUpdates[`stageTasks.${sk}`] = rippled[sk] || []; });
    await save(firestoreUpdates);
  }

  async function advanceStage() {
    const idx = STAGE_KEYS.indexOf(engagement.currentStage);
    if (idx >= STAGE_KEYS.length - 1) return;
    const nextKey = STAGE_KEYS[idx + 1];
    const updates = { currentStage: nextKey };

    if (!(engagement.stageTasks?.[nextKey]?.length)) {
      // Start next stage the working day after current stage ends (or today)
      const currentEnd = stageEndDate(engagement.stageTasks?.[engagement.currentStage] || []);
      const nextStart = currentEnd ? workingDayAdd(currentEnd, 1) : todayIso();
      updates[`stageTasks.${nextKey}`] = buildDefaultTasks(nextKey, nextStart);
    }
    await save(updates);
    setActiveStage(nextKey);
  }

  const allTasks = STAGE_KEYS.flatMap(sk => engagement.stageTasks?.[sk] || []);
  const doneTasks = allTasks.filter(t => t.done).length;
  const totalPct = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0;
  const currentStageDef = STAGES.find(s => s.key === engagement.currentStage);

  // Memoized callback for GanttChart — stable reference prevents unnecessary remounts
  const ganttUpdateTask = useCallback((stageKey, taskId, updates) => {
    const tasks = engagement.stageTasks?.[stageKey] || [];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) updateTask(stageKey, idx, updates);
  }, [engagement.stageTasks]); // eslint-disable-line react-hooks/exhaustive-deps
  const rag = RAG_STATUSES.find(r => r.key === engagement.ragStatus) || RAG_STATUSES[0];

  const stageTabs = STAGE_KEYS.map(sk => {
    const tasks = engagement.stageTasks?.[sk] || [];
    const done = tasks.filter(t => t.done).length;
    return { id: sk, label: STAGES.find(s=>s.key===sk)?.shortLabel, badge: tasks.length > 0 ? `${done}/${tasks.length}` : null };
  });

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      {/* Back + header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, display: "flex", alignItems: "center", gap: 5, padding: 0, fontFamily: "inherit" }}>
          ← All engagements
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Linked customer badge or link button */}
          {engagement.customerId && onOpenCustomer ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button
                onClick={() => onOpenCustomer(engagement.customerId, engagement.customer)}
                style={{ background: "var(--green-light)", border: "1px solid var(--green)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--green)", fontSize: 12, padding: "5px 12px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}
              >
                🏢 {engagement.customer} →
              </button>
              {canEdit && (
                <button
                  onClick={() => { setCustomerSearch(""); setShowLinkCustomer(true); }}
                  style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, padding: "5px 8px", fontFamily: "inherit" }}
                  title="Change linked customer"
                >
                  ✎
                </button>
              )}
            </div>
          ) : canEdit && customers.length > 0 ? (
            <button
              onClick={() => { setCustomerSearch(""); setShowLinkCustomer(true); }}
              style={{ background: "none", border: "1px dashed var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: "5px 12px", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, transition: "all 0.13s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--purple)"; e.currentTarget.style.color = "var(--purple)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              🔗 Link to customer record
            </button>
          ) : null}
        </div>
      </div>

      {/* Customer link picker modal */}
      <Modal open={showLinkCustomer} onClose={() => setShowLinkCustomer(false)} title="Link to customer record" width={480}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>
          Select the customer record this engagement belongs to.
        </p>
        <Input
          value={customerSearch}
          onChange={e => setCustomerSearch(e.target.value)}
          placeholder="Search customers..."
          style={{ marginBottom: 12 }}
        />
        <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {customers
            .filter(c => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase()))
            .map(c => {
              const isLinked = engagement.customerId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={async () => {
                    await updateDoc(doc(db, "engagements", engagement.id), {
                      customerId: c.id,
                      customer: c.name,   // keep name in sync
                      updatedAt: serverTimestamp(),
                    });
                    setShowLinkCustomer(false);
                    setCustomerSearch("");
                  }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: "var(--radius-sm)",
                    background: isLinked ? "var(--green-light)" : "var(--surface2)",
                    border: `1px solid ${isLinked ? "var(--green)" : "var(--border)"}`,
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                    transition: "all 0.13s",
                  }}
                  onMouseEnter={e => { if (!isLinked) { e.currentTarget.style.background = "var(--purple-light)"; e.currentTarget.style.borderColor = "var(--purple)"; }}}
                  onMouseLeave={e => { if (!isLinked) { e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.borderColor = "var(--border)"; }}}
                >
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: isLinked ? "var(--green)" : "var(--text-primary)" }}>{c.name}</p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {[c.segment, c.region, c.csmName && `CSM: ${c.csmName}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {isLinked && <span style={{ fontSize: 12, color: "var(--green)", fontWeight: 600 }}>✓ linked</span>}
                </button>
              );
            })}
          {customers.filter(c => !customerSearch || c.name?.toLowerCase().includes(customerSearch.toLowerCase())).length === 0 && (
            <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>No customers match</p>
          )}
        </div>
        {engagement.customerId && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
            <button
              onClick={async () => {
                await updateDoc(doc(db, "engagements", engagement.id), {
                  customerId: "",
                  updatedAt: serverTimestamp(),
                });
                setShowLinkCustomer(false);
              }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: 12, fontFamily: "inherit", padding: 0 }}
            >
              Remove customer link
            </button>
          </div>
        )}
      </Modal>

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
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="success" onClick={advanceStage}>
              Advance → {STAGES[STAGE_KEYS.indexOf(engagement.currentStage) + 1]?.shortLabel}
            </Btn>
            <button
              onClick={() => setShowDelete(true)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: "6px 12px", fontFamily: "inherit", transition: "all 0.13s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >Delete</button>
          </div>
        )}
        {canEdit && STAGE_KEYS.indexOf(engagement.currentStage) === STAGE_KEYS.length - 1 && (
          <button
            onClick={() => setShowDelete(true)}
            style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: "6px 12px", fontFamily: "inherit", transition: "all 0.13s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
          >Delete</button>
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
          <GanttChart
            stageTasks={engagement.stageTasks || {}}
            canEdit={canEdit}
            onUpdateTask={ganttUpdateTask}
          />
        </Card>
      )}

      {/* ── ACTIVITY ── */}
      {activeTab === "activity" && (
        <Card style={{ padding: 20 }}>
          <ActivityLog engagementId={engagement.id} />
        </Card>
      )}

      {/* Delete confirm */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete engagement" width={420}>
        <p style={{ fontSize: 13, color: "var(--text-second)", marginBottom: 8 }}>
          Are you sure you want to delete <strong>{engagement.customer}</strong>?
        </p>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
          This will permanently remove all tasks, data capture, and activity history for this engagement. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Btn>
          <Btn
            disabled={deleting}
            style={{ background: "var(--red)", color: "white" }}
            onClick={async () => {
              setDeleting(true);
              await deleteDoc(doc(db, "engagements", engagement.id));
              setDeleting(false);
              onBack();
            }}
          >
            {deleting ? "Deleting..." : "Delete engagement"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

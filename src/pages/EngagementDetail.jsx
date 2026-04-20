import { useState, useEffect, useRef, useCallback } from "react";
import React from "react";
import { doc, updateDoc, deleteDoc, serverTimestamp, collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import {
  STAGES, STAGE_KEYS, ENHANCEMENT_STAGE_KEYS, RAG_STATUSES, TASK_TEMPLATES,
  buildDefaultTasks, buildAllStageTasks, rippleTasks, rippleAllStages, stageEndDate,
  fmtDate, fmtDateTime, stageColour, todayIso, workingDayAdd, diffDays
} from "../lib/constants";
import { Card, CardHeader, Label, Pill, Avatar, Btn, Tabs, Input, Select, Textarea, Modal, FieldGroup, Spinner } from "../components/UI";
import CapturePanel, { captureCompleteness } from "../components/CapturePanel";
import { personByEmail, PEOPLE, taskAssigneesForStage } from "../lib/people";

// Task assignees resolved per-stage via taskAssigneesForStage()

// ─── Coming soon placeholder button ──────────────────────────────────────────
function ComingSoonBtn({ icon, label, tooltip }) {
  const [tip, setTip] = React.useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        disabled
        onMouseEnter={() => setTip(true)}
        onMouseLeave={() => setTip(false)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "6px 10px", borderRadius: "var(--radius-sm)",
          border: "1px dashed var(--border2)", background: "transparent",
          color: "var(--text-muted)", fontSize: 11, fontWeight: 600,
          cursor: "not-allowed", fontFamily: "inherit", opacity: 0.75,
        }}
      >
        <span style={{ fontSize: 12 }}>{icon}</span>
        {label}
        <span style={{ fontSize: 9, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 4px", color: "var(--text-muted)", marginLeft: 2 }}>SOON</span>
      </button>
      {tip && tooltip && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          zIndex: 200, background: "#111827", color: "white", fontSize: 11, padding: "6px 10px",
          borderRadius: 6, whiteSpace: "nowrap", boxShadow: "var(--shadow-md)", pointerEvents: "none",
        }}>
          {tooltip}
          <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: "5px solid #111827" }}/>
        </div>
      )}
    </div>
  );
}

// ─── Gantt chart ─────────────────────────────────────────────────────────────
// Architecture: static SVG rendered once per prop change.
// Only the ACTIVE drag bar re-renders (via DraggableBar component state).
// All other bars are pure static SVG — zero overhead per mousemove frame.

function buildLayout(propTasks, minWidth = 600) {
  // Filter to only tasks with plausible dates (within 5 years of today)
  const today = new Date();
  const maxReasonable = new Date(today.getFullYear() + 5, 11, 31).toISOString().slice(0,10);
  const minReasonable = '2020-01-01';

  const validDates = propTasks
    .flatMap(t => [t.startDate, t.endDate])
    .filter(d => d && d >= minReasonable && d <= maxReasonable)
    .sort();

  if (!validDates.length) return null;

  const mn = new Date(validDates[0]);
  const mx = new Date(validDates[validDates.length - 1]);
  mn.setDate(mn.getDate() - 3);
  mx.setDate(mx.getDate() + 8);
  const LABEL_W = 220, HANDLE_W = 8, ROW_H = 30, STAGE_W = 52;
  const totalMs = mx.getTime() - mn.getTime();
  const dateDrivenW = Math.ceil(totalMs / 86400000) * 14;
  const CHART_W = Math.max(dateDrivenW, minWidth, 400);
  return {
    minMs: mn.getTime(), maxDate: mx,
    LABEL_W, HANDLE_W, ROW_H, STAGE_W,
    CHART_W,
    SVG_W: LABEL_W + CHART_W,
    PX_PER_MS: CHART_W / totalMs,
    MS_PER_PX: totalMs / CHART_W,
    maxReasonable,
  };
}

function isoToX(iso, L) {
  if (!iso) return 0;
  return (new Date(iso).getTime() - L.minMs) * L.PX_PER_MS;
}

function msToIso(ms) {
  const d = new Date(ms);
  if (d.getDay() === 6) d.setDate(d.getDate() - 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// A single draggable bar — only this component re-renders during drag
function DraggableBar({ task, idx, L, canEdit, onCommit, containerRef }) {
  const [drag, setDrag]       = React.useState(null);
  const [hover, setHover]     = React.useState(false);
  const dragRef               = React.useRef(null);
  const committedRef          = React.useRef(null);

  const stageCol = stageColour(task.stageKey);
  const movable  = canEdit && !task.done && !task.locked;

  // Determine bar state colour
  const today = todayIso();
  const isOverdue  = !task.done && task.endDate && task.endDate < today;
  const isComplete = task.done;
  // done → green, overdue → red, otherwise stage colour
  const colour = isComplete ? "#16A34A" : isOverdue ? "#EF4444" : stageCol;

  // Don't render bars for tasks with no dates or corrupt far-future dates
  const maxReasonable = L.maxReasonable || '2031-01-01';
  if (!task.startDate || !task.endDate) return <g/>;
  if (task.startDate > maxReasonable || task.endDate > maxReasonable) return <g/>;

  // Once Firestore delivers the committed dates back via props, clear our optimistic state
  if (committedRef.current) {
    const c = committedRef.current;
    if (task.startDate === c.startDate && task.endDate === c.endDate) {
      committedRef.current = null;
      // drag is already null at this point — nothing to do
    }
  }

  // Show: during drag → drag position; after drop until confirmed → committed position; otherwise → prop
  const display = drag || committedRef.current || { start: task.startDate, end: task.endDate };
  const dispStart = display.start;
  const dispEnd   = display.end;

  const x1   = isoToX(dispStart || todayIso(), L);
  const x2   = isoToX(dispEnd   || workingDayAdd(dispStart || todayIso(), 1), L);
  const barW = Math.max(x2 - x1, 4);
  const y    = idx * L.ROW_H + 24 + 4;
  const barH = L.ROW_H - 8;
  const hW   = Math.min(L.HANDLE_W, Math.floor(barW / 2));

  function getX(e) {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    return (cx - rect.left) + el.scrollLeft;
  }

  function startDrag(e, mode) {
    if (!movable) return;
    e.preventDefault();
    e.stopPropagation();

    // Use the currently DISPLAYED start/end (which may be committedRef or prop)
    // so the grab offset is correct regardless of whether Firestore has confirmed yet
    const currentStart = committedRef.current?.start ?? task.startDate;
    const currentEnd   = committedRef.current?.end   ?? task.endDate;

    // Clear any pending committed state — we're starting fresh
    committedRef.current = null;

    const mouseX    = getX(e);
    const barStartX = isoToX(currentStart, L);
    const durMs     = new Date(currentEnd).getTime() - new Date(currentStart).getTime();
    const grabMs    = (mouseX - barStartX) * L.MS_PER_PX;
    const ds        = { mode, durMs, grabMs, origStart: currentStart, origEnd: currentEnd };

    function onMove(ev) {
      if (ev.cancelable) ev.preventDefault();
      const curMs = L.minMs + getX(ev) * L.MS_PER_PX;
      let ns = ds.origStart, ne = ds.origEnd;
      if (mode === "move") {
        ns = msToIso(curMs - ds.grabMs);
        ne = msToIso(new Date(ns).getTime() + ds.durMs);
      } else if (mode === "left") {
        const c = msToIso(curMs); if (c < ds.origEnd) ns = c;
      } else {
        const c = msToIso(curMs); if (c > ds.origStart) ne = c;
      }
      const next = { start: ns, end: ne };
      dragRef.current = next;
      setDrag(next);
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend",  onUp);
      const final = dragRef.current;
      dragRef.current = null;
      // Clear the active drag state immediately (stops drag visuals)
      setDrag(null);
      if (final && (final.start !== ds.origStart || final.end !== ds.origEnd)) {
        // Hold the committed position in a ref so we keep showing it until Firestore confirms
        committedRef.current = final;
        onCommit(task.stageKey, task.id, { startDate: final.start, endDate: final.end });
      }
    }

    dragRef.current = null;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend",  onUp);
  }

  return (
    <g>
      {drag && (
        <rect x={x1+2} y={y+2} width={barW} height={barH} rx={3}
          fill="rgba(0,0,0,0.1)" style={{ pointerEvents:"none" }}/>
      )}
      {/* Bar body */}
      <rect x={x1} y={y} width={barW} height={barH} rx={3}
        fill={isComplete ? colour+"40" : isOverdue ? colour+"60" : task.locked ? colour+"44" : drag ? colour+"BB" : colour+"70"}
        stroke={isOverdue ? colour : task.locked ? colour : "none"}
        strokeWidth={isOverdue || task.locked ? 1.5 : 0}
        strokeDasharray={task.locked && !isOverdue ? "5 2" : "none"}
        style={{ cursor: movable ? "grab" : "default" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseDown={ev => { setHover(false); startDrag(ev, "move"); }}
        onTouchStart={ev => startDrag(ev, "move")}
      />
      {/* Hover tooltip — shows when not dragging */}
      {hover && !drag && (
        <g style={{ pointerEvents: "none" }}>
          <rect
            x={Math.min(Math.max(x1 + barW/2 - 70, 2), L.CHART_W - 142)}
            y={y - 26} width={140} height={20} rx={4}
            fill="#111827" opacity={0.9}
          />
          <text
            x={Math.min(Math.max(x1 + barW/2, 72), L.CHART_W - 72)}
            y={y - 13} textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={10} fontWeight={500}
          >
            {fmtDate(dispStart)} → {fmtDate(dispEnd)}
          </text>
        </g>
      )}
      <rect x={x1} y={y} width={3} height={barH} rx={1} fill={colour}
        style={{ pointerEvents:"none" }}/>
      {task.done && (
        <text x={x1+barW/2} y={y+barH/2+1} textAnchor="middle" dominantBaseline="middle"
          fill={colour} fontSize={9} fontWeight="700" style={{ pointerEvents:"none" }}>✓</text>
      )}
      {task.locked && !task.done && (
        <text x={x1+barW-7} y={y+barH/2+1} textAnchor="middle" dominantBaseline="middle"
          fontSize={8} style={{ pointerEvents:"none" }}>🔒</text>
      )}
      {movable && (
        <>
          <rect x={x1} y={y} width={hW} height={barH} rx={2}
            fill={colour} opacity={0.9} style={{ cursor:"ew-resize" }}
            onMouseDown={ev => { ev.stopPropagation(); startDrag(ev, "left"); }}
            onTouchStart={ev => { ev.stopPropagation(); startDrag(ev, "left"); }}
          />
          <rect x={x1+barW-hW} y={y} width={hW} height={barH} rx={2}
            fill={colour} opacity={0.9} style={{ cursor:"ew-resize" }}
            onMouseDown={ev => { ev.stopPropagation(); startDrag(ev, "right"); }}
            onTouchStart={ev => { ev.stopPropagation(); startDrag(ev, "right"); }}
          />
          {drag && (
            <text x={Math.min(Math.max(x1+barW/2, 66), L.CHART_W-66)}
              y={y-6} textAnchor="middle" dominantBaseline="auto"
              fill="#111827" fontSize={10} fontWeight={600}
              style={{ pointerEvents:"none" }}>
              {fmtDate(dispStart)} → {fmtDate(dispEnd)}
            </text>
          )}
        </>
      )}
    </g>
  );
}

function GanttChart({ stageTasks, onUpdateTask, canEdit }) {
  const containerRef = React.useRef(null);
  const [containerW, setContainerW] = React.useState(0);

  // Measure container on mount and resize
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const propTasks = React.useMemo(() => {
    const out = [];
    STAGE_KEYS.forEach(sk => (stageTasks[sk] || []).forEach(t => out.push({ ...t, stageKey: sk })));
    return out;
  }, [stageTasks]);

  const L = React.useMemo(() => buildLayout(propTasks, containerW || 600), [propTasks, containerW]);

  if (!L || propTasks.length === 0) return (
    <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "20px 0" }}>
      No tasks defined yet. Add tasks to stages to see the Gantt.
    </p>
  );

  const { minMs, maxDate, LABEL_W, CHART_W, SVG_W, ROW_H, STAGE_W } = L;
  const SVG_H = propTasks.length * ROW_H + 24;
  const PANEL_W = STAGE_W + LABEL_W; // total fixed left panel width

  const months = React.useMemo(() => {
    const out = []; const cur = new Date(minMs);
    while (cur <= maxDate) {
      out.push({ label: cur.toLocaleDateString("en-GB", { month:"short", year:"2-digit" }), x: isoToX(cur.toISOString().slice(0,10), L) });
      cur.setMonth(cur.getMonth() + 1); cur.setDate(1);
    }
    return out;
  }, [L]);

  const stageGroups = React.useMemo(() => {
    const groups = []; let last = null, si = 0;
    propTasks.forEach((t, i) => {
      if (t.stageKey !== last) { if (last) groups.push({ key: last, si, ei: i-1 }); last = t.stageKey; si = i; }
    });
    if (last) groups.push({ key: last, si, ei: propTasks.length - 1 });
    return groups;
  }, [propTasks]);

  const todayX    = isoToX(todayIso(), L);
  const showToday = todayX >= 0 && todayX < CHART_W;

  // The outer wrapper is display:flex — fixed panel left, scrollable chart div right
  return (
    <div style={{ display:"flex", userSelect:"none", fontFamily:"Inter,sans-serif" }}>

      {/* ── Fixed left panel: stage column + label column ──────────── */}
      <div style={{ flexShrink:0, width: PANEL_W, background:"#F8F9FC",
                    borderRight:"1px solid #E4E7EF", position:"relative", zIndex:2 }}>
        <svg width={PANEL_W} height={SVG_H} style={{ display:"block", overflow:"visible" }}>

          {/* Row backgrounds */}
          {propTasks.map((_, i) => (
            <rect key={i} x={0} y={i*ROW_H+24} width={PANEL_W} height={ROW_H}
              fill={i%2===0?"#F8F9FC":"#FFFFFF"} />
          ))}

          {/* ── Stage column ── */}
          {stageGroups.map(g => {
            const colour = stageColour(g.key);
            const y      = g.si * ROW_H + 24;
            const h      = (g.ei - g.si + 1) * ROW_H;
            const stage  = STAGES.find(s => s.key === g.key);
            const label  = stage?.shortLabel || stage?.label || g.key;
            const cx     = STAGE_W / 2;
            const cy     = y + h / 2;
            return (
              <g key={g.key}>
                {/* Colour fill */}
                <rect x={0} y={y} width={STAGE_W} height={h}
                  fill={colour + "18"} />
                {/* Left accent strip */}
                <rect x={0} y={y} width={3} height={h}
                  fill={colour} rx={1} />
                {/* Right border */}
                <line x1={STAGE_W} y1={y} x2={STAGE_W} y2={y+h}
                  stroke="#E4E7EF" strokeWidth={1} />
                {/* Stage label — rotated, centred in the merged cell */}
                {h >= 20 && (
                  <text
                    x={cx} y={cy}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={9} fontWeight={600}
                    fill={colour}
                    transform={`rotate(-90, ${cx}, ${cy})`}
                    style={{ letterSpacing: "0.04em", textTransform: "uppercase", pointerEvents:"none" }}
                  >
                    {label.length > 12 ? label.slice(0,11)+"…" : label}
                  </text>
                )}
              </g>
            );
          })}

          {/* ── Task labels ── */}
          {propTasks.map((t, i) => (
            <text key={t.id||i}
              x={PANEL_W - 8}
              y={i*ROW_H + 24 + ROW_H/2 + 1}
              fill={t.done ? "#9CA3AF" : "#374151"} fontSize={10}
              textAnchor="end" dominantBaseline="middle">
              {t.title.length > 30 ? t.title.slice(0,28)+"…" : t.title}
            </text>
          ))}

          {/* Header row cover */}
          <rect x={0} y={0} width={PANEL_W} height={24} fill="#F8F9FC"/>
          {/* Stage column header */}
          <text x={STAGE_W/2} y={13} textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fontWeight={600} fill="#9CA3AF"
            style={{ letterSpacing:"0.06em", textTransform:"uppercase" }}>
            Stage
          </text>
          {/* Divider line between stage and label headers */}
          <line x1={STAGE_W} y1={0} x2={STAGE_W} y2={24} stroke="#E4E7EF" strokeWidth={1}/>
          {/* Bottom border of header */}
          <line x1={0} y1={23} x2={PANEL_W} y2={23} stroke="#E4E7EF" strokeWidth={1}/>
        </svg>
      </div>

      {/* ── Scrollable chart area ───────────────────────────────────── */}
      <div ref={containerRef}
           style={{ flex:1, overflowX:"auto", minWidth:0, position:"relative" }}>
        <svg width={CHART_W} height={SVG_H}
          style={{ display:"block", touchAction:"none" }}>

          {/* Row backgrounds */}
          {propTasks.map((_, i) => (
            <rect key={i} x={0} y={i*ROW_H+24} width={CHART_W} height={ROW_H}
              fill={i%2===0?"#F8F9FC":"#FFFFFF"} />
          ))}

          {/* Month gridlines + labels */}
          {months.map((m, i) => (
            <g key={i}>
              <line x1={m.x} y1={0} x2={m.x} y2={SVG_H} stroke="#E4E7EF" strokeWidth={1}/>
              <text x={m.x+4} y={14} fill="#9CA3AF" fontSize={9}>{m.label}</text>
            </g>
          ))}

          {/* Today marker */}
          {showToday && (
            <g>
              <line x1={todayX} y1={0} x2={todayX} y2={SVG_H}
                stroke="#D97706" strokeWidth={1.5} strokeDasharray="4 3"/>
              <text x={todayX+3} y={14} fill="#D97706" fontSize={9} fontWeight="600">Today</text>
            </g>
          )}

          {/* Task bars */}
          {propTasks.map((t, i) => (
            <DraggableBar key={t.id||i} task={t} idx={i} L={L}
              canEdit={canEdit} onCommit={onUpdateTask} containerRef={containerRef} />
          ))}
        </svg>

        {canEdit && (
          <p style={{ fontSize:10, color:"var(--text-muted)", padding:"4px 6px 10px" }}>
            Drag bars to move · drag edges to resize · click 🔓 on a task to pin its dates
          </p>
        )}
      </div>
    </div>
  );
}



// ─── Task row ─────────────────────────────────────────────────────────────────
const CALL_KEYWORDS = ["call", "session", "meeting", "kickoff", "intro", "discovery", "review", "demo", "uat", "handover", "training", "qbr"];
function isCallTask(title) { return CALL_KEYWORDS.some(k => title?.toLowerCase().includes(k)); }

function TaskRow({ task, stageKey, onUpdate, onDelete, stageColour: sc, users }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "20px 1fr 130px 100px 100px 56px 28px 28px 28px",
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
      {/* Owner — stage-aware grouped dropdown */}
      {(() => {
        const { defaultPeople, grouped } = taskAssigneesForStage(stageKey);
        const currentVal = task.ownerEmail || task.ownerUid || "";
        // Check if current value is in "other" people (need Show all to be visible)
        const inDefault = defaultPeople.find(p => p.email === currentVal);
        return (
          <Select
            value={currentVal}
            onChange={e => {
              const val = e.target.value;
              if (val.includes("@")) onUpdate({ ownerEmail: val, ownerUid: "" });
              else onUpdate({ ownerUid: val, ownerEmail: "" });
            }}
            style={{ fontSize: 11, padding: "4px 8px" }}
          >
            <option value="">Unassigned</option>
            {/* Stage defaults */}
            <optgroup label="Typically responsible">
              {defaultPeople.map(p => (
                <option key={p.email} value={p.email}>{p.name}</option>
              ))}
            </optgroup>
            {/* All others grouped by team */}
            {Object.entries(grouped).map(([team, people]) => (
              <optgroup key={team} label={team}>
                {people.map(p => <option key={p.email} value={p.email}>{p.name}</option>)}
              </optgroup>
            ))}
            {/* Signed-in Firebase users not in directory */}
            {users.filter(u => !PEOPLE.find(p => p.email === u.email)).map(u => (
              <option key={u.uid} value={u.uid}>{u.displayName}</option>
            ))}
          </Select>
        );
      })()}
      <input type="date" value={task.startDate || ""} onChange={e => onUpdate({ startDate: e.target.value })}
        style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${task.locked ? "var(--purple)" : "var(--border)"}`, borderRadius: 6, fontFamily: "inherit", outline: "none" }}/>
      <input type="date" value={task.endDate || ""} onChange={e => onUpdate({ endDate: e.target.value })}
        style={{ fontSize: 11, padding: "4px 8px", border: `1px solid ${task.locked ? "var(--purple)" : "var(--border)"}`, borderRadius: 6, fontFamily: "inherit", outline: "none" }}/>
      <Pill color={task.done ? "green" : task.required ? "purple" : "grey"} style={{ fontSize: 10 }}>
        {task.done ? "Done" : task.required ? "Req" : "Opt"}
      </Pill>
      {/* Calendar placeholder — only shows on call-type tasks */}
      <button
        disabled
        title="Schedule in Google Calendar — coming soon (requires Google OAuth)"
        style={{
          background: "none", border: "none", cursor: "not-allowed",
          fontSize: 13, padding: 2, borderRadius: 4, opacity: isCallTask(task.title) ? 0.5 : 0.15,
          color: "var(--text-muted)",
        }}
      >📅</button>
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

  // Use the right stage set for this engagement's plan type
  const isEnhancement = engagement.planType === "Enhancement";
  const stageKeys = isEnhancement ? ENHANCEMENT_STAGE_KEYS : STAGE_KEYS;
  const stageList  = STAGES.filter(s => stageKeys.includes(s.key));

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
      stageKeys.forEach(sk => {
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
    stageKeys.forEach(sk => { firestoreUpdates[`stageTasks.${sk}`] = rippled[sk] || []; });
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
    const prevKey = stageKeys[stageKeys.indexOf(stageKey) - 1];
    const prevEnd = prevKey ? stageEndDate(engagement.stageTasks?.[prevKey] || []) : null;
    const startDate = prevEnd ? workingDayAdd(prevEnd, 1) : todayIso();
    const newTasks = buildDefaultTasks(stageKey, startDate);
    const rippled = rippleAllStages({ ...engagement.stageTasks, [stageKey]: newTasks }, stageKey);
    const firestoreUpdates = {};
    stageKeys.forEach(sk => { firestoreUpdates[`stageTasks.${sk}`] = rippled[sk] || []; });
    await save(firestoreUpdates);
  }

  async function advanceStage() {
    const idx = stageKeys.indexOf(engagement.currentStage);
    if (idx >= stageKeys.length - 1) return;
    const nextKey = stageKeys[idx + 1];
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

  const allTasks = stageKeys.flatMap(sk => engagement.stageTasks?.[sk] || []);
  const doneTasks = allTasks.filter(t => t.done).length;
  const totalPct = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0;
  const currentStageDef = STAGES.find(s => s.key === engagement.currentStage);

  // Memoized callback for GanttChart — writes only the dragged task, no cross-stage ripple
  // (ripple still runs but only within the changed stage, keeping writes minimal)
  // Keep a ref to the latest engagement so ganttUpdateTask never uses a stale closure
  const engagementRef = React.useRef(engagement);
  engagementRef.current = engagement;

  const ganttUpdateTask = useCallback(async (stageKey, taskId, updates) => {
    const eng = engagementRef.current;
    const tasks = [...(eng.stageTasks?.[stageKey] || [])];
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], ...updates };
    const rippled = rippleTasks(tasks);
    await updateDoc(doc(db, "engagements", eng.id), {
      [`stageTasks.${stageKey}`]: rippled,
      updatedAt: serverTimestamp(),
    });
  }, []); // empty deps — always reads fresh data via ref
  const rag = RAG_STATUSES.find(r => r.key === engagement.ragStatus) || RAG_STATUSES[0];

  const stageTabs = stageKeys.map(sk => {
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
            <Pill color={isEnhancement ? "purple" : "orange"}>
              {isEnhancement ? "⚡ Enhancement" : "🚀 Onboarding"}
            </Pill>
            {saving && <Spinner size={14} />}
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {[engagement.csId, engagement.region, engagement.segment, engagement.tshirt].filter(Boolean).join(" · ")}
            {engagement.arr && ` · £${Number(engagement.arr).toLocaleString()}`}
          </p>
        </div>
        {canEdit && stageKeys.indexOf(engagement.currentStage) < stageKeys.length - 1 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="success" onClick={advanceStage}>
              Advance → {stageList[stageKeys.indexOf(engagement.currentStage) + 1]?.shortLabel}
            </Btn>
            <ComingSoonBtn
              icon="💬"
              label="Post to Slack"
              tooltip="Notify your team channel when this stage advances — requires Slack OAuth setup"
            />
            <ComingSoonBtn
              icon="🎟"
              label="Sync to Jira"
              tooltip="Create or update a linked Jira epic — requires Atlassian OAuth setup"
            />
            <button
              onClick={() => setShowDelete(true)}
              style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: "6px 12px", fontFamily: "inherit", transition: "all 0.13s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >Delete</button>
          </div>
        )}
        {canEdit && stageKeys.indexOf(engagement.currentStage) === stageKeys.length - 1 && (
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
        {stageList.map((s, i) => {
          const isCurrent = s.key === engagement.currentStage;
          const isPast = stageKeys.indexOf(s.key) < stageKeys.indexOf(engagement.currentStage);
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
                {[["AE", engagement.aeEmail, engagement.aeUid], ["CSE", engagement.cseEmail, engagement.cseUid], ["CSM", engagement.csmEmail, engagement.csmUid], ["TA", engagement.taEmail, engagement.taUid]].map(([role, email, uid]) => {
                  // Resolve from directory first, then fall back to Firebase users
                  const dirPerson = email ? personByEmail(email) : null;
                  const firebaseUser = uid ? users.find(u => u.uid === uid) : null;
                  const person = dirPerson || (firebaseUser ? { name: firebaseUser.displayName, email: firebaseUser.email, initials: firebaseUser.displayName?.split(" ").map(n=>n[0]).join("").slice(0,2) } : null);
                  if (!person) return null;
                  const roleColours = { AE: "var(--amber)", CSE: "var(--purple)", CSM: "var(--green)", TA: "#7C4DFF" };
                  return (
                    <div key={role} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: (roleColours[role] || "var(--purple)") + "22", color: roleColours[role] || "var(--purple)", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {person.initials || person.name?.split(" ").map(n=>n[0]).join("").slice(0,2)}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 500 }}>{person.name}</p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)" }}>{role}</p>
                      </div>
                    </div>
                  );
                })}
                {!engagement.aeEmail && !engagement.aeUid && !engagement.cseEmail && !engagement.cseUid && !engagement.csmEmail && !engagement.csmUid && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>No team assigned yet</p>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader><Label>Stage summary</Label></CardHeader>
              <div>
                {stageList.map((s, i) => {
                  const tasks = engagement.stageTasks?.[s.key] || [];
                  const done = tasks.filter(t=>t.done).length;
                  const isCurrent = s.key === engagement.currentStage;
                  const isPast = stageKeys.indexOf(s.key) < stageKeys.indexOf(engagement.currentStage);
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
            {stageList.map(s => {
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
                        <div style={{ display: "grid", gridTemplateColumns: "20px 1fr 130px 100px 100px 56px 28px 28px 28px", gap: 8, padding: "7px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                          {["✓", "Task", "Owner", "Start", "End", "Status", "📅", "", ""].map((h, i) => <Label key={i} title={h === "📅" ? "Schedule in Google Calendar (coming soon)" : undefined}>{h}</Label>)}
                        </div>
                        {tasks.map((task, i) => (
                          <TaskRow key={task.id || i} task={task}
                            stageKey={activeStage}
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
        <div style={{ margin: "0 -28px -48px", background: "var(--surface)", borderTop: "1px solid var(--border)" }}>
          <GanttChart
            stageTasks={engagement.stageTasks || {}}
            canEdit={canEdit}
            onUpdateTask={ganttUpdateTask}
          />
        </div>
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

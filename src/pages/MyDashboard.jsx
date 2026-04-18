import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, onSnapshot, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import {
  STAGES, STAGE_KEYS, ENHANCEMENT_STAGE_KEYS,
  fmtDate, fmtDateTime, stageColour, todayIso, workingDayAdd, rippleTasks, rippleAllStages, stageEndDate
} from "../lib/constants";
import { Pill, Btn, Input, Textarea, Modal, Spinner, Avatar, Label, FieldGroup } from "../components/UI";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isoToDate(iso) { return iso ? new Date(iso + "T00:00:00") : null; }
function dateToIso(d) { return d ? d.toISOString().slice(0, 10) : ""; }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d) { const r = new Date(d); r.setDate(r.getDate() - ((r.getDay() + 6) % 7)); return r; } // Mon start
function sameDay(a, b) { return a && b && a.toDateString() === b.toDateString(); }
// Compare by ISO string to avoid timezone issues
function dateInRange(dayDate, startIso, endIso) {
  if (!startIso || !endIso) return false;
  const d = dateToIso(dayDate);
  return d >= startIso && d <= endIso;
}

const GLEAN_MCP = { type: "url", url: "https://safetyculture-be.glean.com/mcp/claude", name: "glean" };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Task types that suggest a customer call
const CALL_KEYWORDS = ["call", "session", "meeting", "kickoff", "intro", "discovery", "review", "demo", "uat", "handover", "training", "qbr"];
function isCallTask(title) { return CALL_KEYWORDS.some(k => title?.toLowerCase().includes(k)); }

// ─── Meeting panel — schedule, track, Gong link, call prep ────────────────────
function MeetingPanel({ task, engagement, onClose, onSave }) {
  const [gongLink, setGongLink] = useState(task.gongLink || "");
  const [meetingNotes, setMeetingNotes] = useState(task.meetingNotes || "");
  const [meetingDate, setMeetingDate] = useState(task.meetingDate || task.startDate || todayIso());
  const [prep, setPrep] = useState(null);
  const [prepLoading, setPrepLoading] = useState(false);
  const [prepError, setPrepError] = useState(null);
  const [tab, setTab] = useState("track"); // track | prep

  async function runCallPrep() {
    setPrepLoading(true); setPrepError(null); setPrep(null);
    try {
      const response = await fetch("/api/call-prep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskTitle:       task.title,
          stageLabel:      STAGES.find(s => s.key === task.stageKey)?.label || task.stageKey,
          customer:        engagement?.customer,
          engagementNotes: engagement?.notes || "",
          modules:         engagement?.modules || [],
          integrations:    engagement?.integrations || [],
          oppType:         engagement?.oppType || "",
          planType:        engagement?.planType || "Onboarding",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Server error ${response.status}`);
      setPrep(data.result);
    } catch (err) {
      setPrepError(err.message);
    } finally {
      setPrepLoading(false);
    }
  }

  async function handleSave() {
    await onSave({ gongLink, meetingNotes, meetingDate });
    onClose();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 16, gap: 2 }}>
        {[["track", "📅 Track meeting"], ["prep", "🧠 Call prep"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "8px 14px", fontSize: 12, fontWeight: tab === id ? 700 : 400,
            border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
            color: tab === id ? "var(--purple)" : "var(--text-second)",
            borderBottom: `2px solid ${tab === id ? "var(--purple)" : "transparent"}`,
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === "track" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FieldGroup label="Meeting date">
            <Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Gong recording link">
            <Input
              value={gongLink}
              onChange={e => setGongLink(e.target.value)}
              placeholder="https://app.gong.io/call?id=..."
            />
            {gongLink && (
              <a href={gongLink} target="_blank" rel="noreferrer"
                style={{ fontSize: 11, color: "var(--purple)", marginTop: 4, display: "inline-block" }}>
                ↗ Open in Gong
              </a>
            )}
          </FieldGroup>
          <FieldGroup label="Meeting notes">
            <Textarea
              value={meetingNotes}
              onChange={e => setMeetingNotes(e.target.value)}
              placeholder="Key points discussed, decisions made, action items..."
              rows={4}
            />
          </FieldGroup>
          <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
            <Btn onClick={handleSave} style={{ flex: 1 }}>Save meeting</Btn>
            <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          </div>
        </div>
      )}

      {tab === "prep" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!prep && !prepLoading && (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🧠</div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                AI Call Preparation
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 18, lineHeight: 1.6, maxWidth: 320, margin: "0 auto 18px" }}>
                Searches Glean for previous calls, Slack messages, emails, and relevant SC documentation to build your brief.
              </p>
              <Btn onClick={runCallPrep} style={{ minWidth: 180 }}>
                Prepare for {engagement?.customer || "this call"} →
              </Btn>
            </div>
          )}

          {prepLoading && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <Spinner size={24} />
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
                Searching Glean for customer context...
              </p>
            </div>
          )}

          {prepError && (
            <div style={{ padding: "10px 14px", borderRadius: "var(--radius)", background: "var(--red-light)", fontSize: 12, color: "var(--red)" }}>
              {prepError}
            </div>
          )}

          {prep && !prep.raw && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Source confidence banner */}
              {prep.sourceSummary && (
                <div style={{ padding: "8px 12px", borderRadius: "var(--radius)", background: "var(--surface2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12 }}>
                    {prep.sourceConfidence === "high" ? "🟢" : prep.sourceConfidence === "medium" ? "🟠" : "⚪"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-second)" }}>{prep.sourceSummary}</span>
                </div>
              )}

              {/* Previous call */}
              {prep.previousCallSummary && (
                <PrepSection title="📞 Last call summary" colour="var(--blue)">
                  <p style={{ fontSize: 12, color: "var(--text-second)", lineHeight: 1.6 }}>{prep.previousCallSummary}</p>
                </PrepSection>
              )}

              {/* Customer context */}
              {prep.customerContext && (
                <PrepSection title="🏢 Customer context" colour="var(--teal)">
                  <p style={{ fontSize: 12, color: "var(--text-second)", lineHeight: 1.6 }}>{prep.customerContext}</p>
                </PrepSection>
              )}

              {/* Talking points */}
              {prep.talkingPoints?.length > 0 && (
                <PrepSection title="💬 Talking points" colour="var(--purple)">
                  {prep.talkingPoints.map((p, i) => <PrepBullet key={i}>{p}</PrepBullet>)}
                </PrepSection>
              )}

              {/* Critical questions to ask */}
              {prep.criticalQuestions?.length > 0 && (
                <PrepSection title="❓ Critical questions to ask" colour="var(--amber)">
                  {prep.criticalQuestions.map((q, i) => <PrepBullet key={i}>{q}</PrepBullet>)}
                </PrepSection>
              )}

              {/* Who should attend */}
              {prep.whoShouldAttend?.length > 0 && (
                <PrepSection title="👥 Who should be on this call" colour="var(--blue)">
                  {prep.whoShouldAttend.map((w, i) => <PrepBullet key={i}>{w}</PrepBullet>)}
                </PrepSection>
              )}

              {/* What they've mentioned */}
              {prep.customerMentioned?.length > 0 && (
                <PrepSection title="🗂 Topics they've raised" colour="var(--orange)">
                  {prep.customerMentioned.map((m, i) => (
                    <div key={i} style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{m.topic}: </span>
                      <span style={{ fontSize: 11, color: "var(--text-second)" }}>{m.detail}</span>
                    </div>
                  ))}
                </PrepSection>
              )}

              {/* Data gaps */}
              {prep.dataGapsToFill?.length > 0 && (
                <PrepSection title="⚠ Data gaps to fill on this call" colour="var(--red)">
                  {prep.dataGapsToFill.map((g, i) => <PrepBullet key={i}>{g}</PrepBullet>)}
                </PrepSection>
              )}

              {/* SC Docs */}
              {prep.scDocs?.length > 0 && (
                <PrepSection title="📄 Relevant SC documentation" colour="var(--green)">
                  {prep.scDocs.map((d, i) => (
                    <div key={i} style={{ marginBottom: 6 }}>
                      {d.url
                        ? <a href={d.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "var(--purple)" }}>{d.title} ↗</a>
                        : <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)" }}>{d.title}</span>
                      }
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{d.relevance}</p>
                    </div>
                  ))}
                </PrepSection>
              )}

              {/* Next steps */}
              {prep.nextSteps?.length > 0 && (
                <PrepSection title="✅ Confirm on this call" colour="var(--green)">
                  {prep.nextSteps.map((s, i) => <PrepBullet key={i}>{s}</PrepBullet>)}
                </PrepSection>
              )}

              <Btn variant="ghost" onClick={runCallPrep} style={{ fontSize: 11 }}>↺ Regenerate</Btn>
            </div>
          )}

          {prep?.raw && (
            <div style={{ fontSize: 12, color: "var(--text-second)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {prep.raw}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PrepSection({ title, colour, children }) {
  return (
    <div style={{
      border: `1px solid ${colour}30`,
      borderLeft: `3px solid ${colour}`,
      borderRadius: "var(--radius)",
      padding: "10px 12px",
      background: `${colour}08`,
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: colour, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>{title}</p>
      {children}
    </div>
  );
}

function PrepBullet({ children }) {
  return (
    <div style={{ display: "flex", gap: 7, marginBottom: 4, alignItems: "flex-start" }}>
      <span style={{ color: "var(--purple)", flexShrink: 0, marginTop: 1 }}>·</span>
      <span style={{ fontSize: 12, color: "var(--text-second)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

// ─── Inline task editor ────────────────────────────────────────────────────────
function TaskEditPanel({ task, engagement, users, onSave, onClose }) {
  const [form, setForm] = useState({
    title:     task.title || "",
    startDate: task.startDate || "",
    endDate:   task.endDate || "",
    ownerUid:  task.ownerUid || "",
    done:      task.done || false,
    notes:     task.notes || "",
    locked:    task.locked || false,
  });
  const [saving, setSaving] = useState(false);
  const [showMeeting, setShowMeeting] = useState(false);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    setSaving(true);
    await onSave(form);
    setSaving(false);
    onClose();
  }

  async function handleMeetingSave(meetingData) {
    await onSave({ ...form, ...meetingData });
  }

  if (showMeeting) {
    return (
      <MeetingPanel
        task={{ ...task, ...form }}
        engagement={engagement}
        onClose={() => setShowMeeting(false)}
        onSave={handleMeetingSave}
      />
    );
  }

  const stageLabel = STAGES.find(s => s.key === task.stageKey)?.label || task.stageKey;
  const colour = stageColour(task.stageKey);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Context breadcrumb */}
      <div style={{
        display: "flex", alignItems: "center", gap: 6, padding: "8px 12px",
        borderRadius: "var(--radius)", background: colour + "10",
        border: `1px solid ${colour}30`,
      }}>
        <span style={{ fontSize: 11, color: colour, fontWeight: 700 }}>
          {STAGES.find(s => s.key === task.stageKey)?.icon} {stageLabel}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>·</span>
        <span style={{ fontSize: 11, color: "var(--text-second)", fontWeight: 600 }}>{engagement?.customer || "—"}</span>
        {engagement?.csId && <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{engagement.csId}</span>}
      </div>

      {/* Done toggle */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox" checked={form.done} onChange={e => upd("done", e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--green)", cursor: "pointer" }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: form.done ? "var(--green)" : "var(--text-second)" }}>
          {form.done ? "Completed ✓" : "Mark as complete"}
        </span>
      </label>

      <FieldGroup label="Task title">
        <Input value={form.title} onChange={e => upd("title", e.target.value)} />
      </FieldGroup>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FieldGroup label="Start date">
          <Input type="date" value={form.startDate} onChange={e => upd("startDate", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="End date">
          <Input type="date" value={form.endDate} onChange={e => upd("endDate", e.target.value)} />
        </FieldGroup>
      </div>

      <FieldGroup label="Assigned to">
        <select
          value={form.ownerUid || ""}
          onChange={e => upd("ownerUid", e.target.value)}
          style={{ width: "100%", padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontFamily: "inherit", fontSize: 13, background: "var(--surface)", color: "var(--text-primary)", outline: "none" }}
        >
          <option value="">— Unassigned —</option>
          {(users || []).map(u => (
            <option key={u.uid} value={u.uid}>{u.displayName}</option>
          ))}
        </select>
      </FieldGroup>

      <FieldGroup label="Notes">
        <Textarea value={form.notes} onChange={e => upd("notes", e.target.value)} placeholder="Any additional context..." rows={3} />
      </FieldGroup>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={form.locked} onChange={e => upd("locked", e.target.checked)}
          style={{ width: 14, height: 14, accentColor: "var(--purple)", cursor: "pointer" }} />
        <span style={{ fontSize: 12, color: "var(--text-second)" }}>🔒 Lock dates (won't move with ripple)</span>
      </label>

      {/* Gong/meeting track for call-type tasks */}
      {isCallTask(task.title) && (
        <div style={{
          padding: "10px 12px", borderRadius: "var(--radius)",
          background: task.gongLink ? "var(--green-light)" : "var(--surface2)",
          border: `1px solid ${task.gongLink ? "var(--green)" : "var(--border)"}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: task.gongLink ? "var(--green)" : "var(--text-second)" }}>
              {task.gongLink ? "📹 Gong recording linked" : "📹 Meeting tracking"}
            </p>
            {task.gongLink && (
              <a href={task.gongLink} target="_blank" rel="noreferrer"
                style={{ fontSize: 10, color: "var(--green)" }}>
                View in Gong ↗
              </a>
            )}
          </div>
          <Btn variant="ghost" onClick={() => setShowMeeting(true)} style={{ fontSize: 11, padding: "5px 10px" }}>
            {task.gongLink ? "Edit" : "Track & prep →"}
          </Btn>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
        <Btn onClick={handleSave} disabled={saving} style={{ flex: 1 }}>
          {saving ? "Saving..." : "Save changes"}
        </Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </div>
  );
}

// ─── Task card for list view ──────────────────────────────────────────────────
function TaskCard({ item, users, onEdit, onToggleDone }) {
  const { task, engagement } = item;
  const colour = stageColour(task.stageKey);
  const stageDef = STAGES.find(s => s.key === task.stageKey);
  const owner = users?.find(u => u.uid === task.ownerUid);
  const today = todayIso();
  const isOverdue = !task.done && task.endDate && task.endDate < today;
  const isDueToday = !task.done && task.endDate === today;
  const isCall = isCallTask(task.title);

  return (
    <div
      onClick={() => onEdit(item)}
      style={{
        background: "var(--surface)",
        border: `1px solid ${isOverdue ? "var(--red)" : isDueToday ? "var(--amber)" : task.done ? "var(--border)" : "var(--border)"}`,
        borderLeft: `3px solid ${task.done ? "var(--green)" : isOverdue ? "var(--red)" : colour}`,
        borderRadius: "var(--radius)",
        padding: "11px 14px",
        cursor: "pointer",
        transition: "all 0.13s",
        opacity: task.done ? 0.55 : 1,
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.borderColor = colour; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = isOverdue ? "var(--red)" : isDueToday ? "var(--amber)" : "var(--border)"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Done checkbox */}
        <div
          onClick={e => { e.stopPropagation(); onToggleDone(item); }}
          style={{
            width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
            border: `2px solid ${task.done ? "var(--green)" : "var(--border2)"}`,
            background: task.done ? "var(--green)" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all 0.1s",
          }}
        >
          {task.done && <span style={{ fontSize: 9, color: "white", fontWeight: 700 }}>✓</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textDecoration: task.done ? "line-through" : "none" }}>
              {task.title}
            </span>
            {isCall && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "rgba(14,165,233,0.12)", color: "var(--blue)", fontWeight: 700 }}>📹 call</span>}
            {task.gongLink && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "var(--green-light)", color: "var(--green)", fontWeight: 700 }}>● recorded</span>}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* Customer / engagement */}
            <span style={{ fontSize: 11, color: "var(--text-second)", fontWeight: 500 }}>{engagement?.customer || "—"}</span>

            {/* Stage */}
            <span style={{ fontSize: 10, color: colour, fontWeight: 600, background: colour + "15", padding: "1px 6px", borderRadius: 999 }}>
              {stageDef?.icon} {stageDef?.shortLabel}
            </span>

            {/* Dates */}
            {task.startDate && (
              <span style={{
                fontSize: 10,
                fontWeight: isOverdue ? 700 : isDueToday ? 700 : 400,
                color: isOverdue ? "var(--red)" : isDueToday ? "var(--amber)" : "var(--text-muted)",
              }}>
                {isOverdue ? "⚠ overdue · " : isDueToday ? "⏰ today · " : ""}
                {fmtDate(task.startDate)}{task.endDate !== task.startDate ? ` → ${fmtDate(task.endDate)}` : ""}
              </span>
            )}

            {/* Owner */}
            {owner && (
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {owner.displayName?.split(" ")[0]}
              </span>
            )}
          </div>
        </div>

        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>›</span>
      </div>
    </div>
  );
}

// ─── Calendar day cell ────────────────────────────────────────────────────────
// tasks = items that START on this day (for rendering)
// spanCount = total tasks active on this day (for overflow display)
function CalendarDayCell({ date, startTasks, spanCount, isToday, isCurrentMonth, isSelected, onDayClick, onTaskClick }) {
  const dayNum = date.getDate();
  const visibleTasks = startTasks.slice(0, 3);
  const overflow = spanCount - visibleTasks.length;

  return (
    <div
      onClick={() => onDayClick(dateToIso(date))}
      style={{
        minHeight: 90, padding: "6px 7px",
        background: isSelected ? "var(--purple-light)" : isToday ? "#EEF4FF" : "var(--surface)",
        border: `1px solid ${isSelected ? "var(--purple)" : isToday ? "#A5B4FC" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        opacity: isCurrentMonth ? 1 : 0.35,
        display: "flex", flexDirection: "column", gap: 2,
        cursor: "pointer", transition: "background 0.1s",
        boxShadow: isSelected ? "0 0 0 2px rgba(101,89,255,0.25)" : "none",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface2)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "var(--purple-light)" : isToday ? "#EEF4FF" : "var(--surface)"; }}
    >
      <span style={{
        fontSize: 11, fontWeight: isToday || isSelected ? 800 : 500,
        color: isSelected ? "var(--purple)" : isToday ? "#6366F1" : "var(--text-second)",
        marginBottom: 2, lineHeight: 1, flexShrink: 0,
      }}>
        {isToday ? "Today" : dayNum}
      </span>
      {visibleTasks.map((item, i) => {
        const colour = stageColour(item.task.stageKey);
        // Calculate how many days this task spans (capped at remaining days visible)
        return (
          <div
            key={i}
            onClick={e => { e.stopPropagation(); onTaskClick(item); }}
            title={`${item.task.title} — ${item.engagement?.customer} (${fmtDate(item.task.startDate)} → ${fmtDate(item.task.endDate)})`}
            style={{
              fontSize: 9, lineHeight: 1.4, padding: "2px 6px",
              borderRadius: 4,
              background: item.task.done ? "var(--green-light)" : colour + "22",
              color: item.task.done ? "var(--green)" : colour,
              fontWeight: 700, cursor: "pointer", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
              borderLeft: `2px solid ${item.task.done ? "var(--green)" : colour}`,
              textDecoration: item.task.done ? "line-through" : "none",
            }}
            onMouseEnter={e => { e.stopPropagation(); e.currentTarget.style.opacity = "0.75"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
          >
            {isCallTask(item.task.title) && "📹 "}
            {item.task.title.length > 18 ? item.task.title.slice(0, 17) + "…" : item.task.title}
          </div>
        );
      })}
      {overflow > 0 && (
        <span style={{ fontSize: 9, color: "var(--text-muted)", paddingLeft: 2, marginTop: 1 }}>
          +{overflow} more
        </span>
      )}
    </div>
  );
}

// ─── Week calendar ────────────────────────────────────────────────────────────
function WeekCalendar({ tasks, weekStart, selectedDay, onDayClick, onTaskClick }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {days.map((d, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{DAYS[i]}</p>
            <p style={{ fontSize: 16, fontWeight: sameDay(d, today) ? 800 : 500, color: sameDay(d, today) ? "var(--purple)" : "var(--text-second)" }}>
              {d.getDate()}
            </p>
            <p style={{ fontSize: 9, color: "var(--text-muted)" }}>{MONTHS[d.getMonth()]}</p>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {days.map((d, i) => {
          const iso = dateToIso(d);
          const startTasks = tasks.filter(item => item.task.startDate === iso);
          const spanCount  = tasks.filter(item => dateInRange(d, item.task.startDate, item.task.endDate)).length;
          return (
            <CalendarDayCell
              key={i} date={d}
              startTasks={startTasks} spanCount={spanCount}
              isToday={sameDay(d, today)} isCurrentMonth={true}
              isSelected={selectedDay === iso}
              onDayClick={onDayClick} onTaskClick={onTaskClick}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Month calendar ──────────────────────────────────────────────────────────
function MonthCalendar({ tasks, monthStart, selectedDay, onDayClick, onTaskClick }) {
  const today = new Date();
  const year = monthStart.getFullYear(), month = monthStart.getMonth();
  const firstDay = new Date(year, month, 1);
  const gridStart = startOfWeek(firstDay);
  const cells = [];
  for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
        {DAYS.map(d => (
          <p key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{d}</p>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          const iso = dateToIso(d);
          const startTasks = tasks.filter(item => item.task.startDate === iso);
          const spanCount  = tasks.filter(item => dateInRange(d, item.task.startDate, item.task.endDate)).length;
          return (
            <CalendarDayCell
              key={i} date={d}
              startTasks={startTasks} spanCount={spanCount}
              isToday={sameDay(d, today)}
              isCurrentMonth={d.getMonth() === month}
              isSelected={selectedDay === iso}
              onDayClick={onDayClick} onTaskClick={onTaskClick}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function MyDashboard({ onSelectEngagement, users }) {
  const { user, profile } = useAuth();
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [calView, setCalView] = useState("month"); // week | month
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date()));
  const [monthStart, setMonthStart] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [editingItem, setEditingItem] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null); // ISO string of clicked day
  const [listFilter, setListFilter] = useState("mine"); // mine | all | overdue | upcoming | calls
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    const q = collection(db, "engagements");
    const unsub = onSnapshot(q, snap => {
      setEngagements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  // Flatten all tasks across all engagements with context
  const allItems = useMemo(() => {
    const items = [];
    const today = todayIso();
    engagements.forEach(eng => {
      const keys = eng.planType === "Enhancement" ? ENHANCEMENT_STAGE_KEYS : STAGE_KEYS;
      keys.forEach(sk => {
        (eng.stageTasks?.[sk] || []).forEach(task => {
          items.push({ task, engagement: eng, stageKey: sk });
        });
      });
    });
    return items;
  }, [engagements]);

  // My tasks = tasks assigned to logged-in user
  const myUid = user?.uid;
  const today = todayIso();

  // Managers (admin/super_admin) see all tasks; others see only their own on the calendar
  const isManager = profile?.role === "admin" || profile?.role === "super_admin";

  // Calendar shows: managers see all, others see only their assigned tasks
  const calendarItems = useMemo(() => {
    const base = allItems.filter(i => !i.task.done || showDone);
    if (isManager) return base;
    return base.filter(i => i.task.ownerUid === myUid);
  }, [allItems, showDone, isManager, myUid]);

  const filteredItems = useMemo(() => {
    let base = allItems;
    if (!showDone) base = base.filter(i => !i.task.done);

    // Day selection overrides the list filter — show tasks active on that specific day
    if (selectedDay) {
      return base.filter(i =>
        dateInRange(new Date(selectedDay + "T00:00:00"), i.task.startDate, i.task.endDate)
      );
    }

    switch (listFilter) {
      case "mine":     return base.filter(i => i.task.ownerUid === myUid);
      case "overdue":  return base.filter(i => i.task.endDate && i.task.endDate < today);
      case "upcoming": return base.filter(i => i.task.startDate && i.task.startDate >= today && i.task.startDate <= workingDayAdd(today, 14));
      case "calls":    return base.filter(i => isCallTask(i.task.title));
      default:         return base;
    }
  }, [allItems, listFilter, selectedDay, showDone, myUid, today]);

  // Stats
  const myTasks    = allItems.filter(i => !i.task.done && i.task.ownerUid === myUid);
  const overdue    = allItems.filter(i => !i.task.done && i.task.endDate && i.task.endDate < today);
  const dueThisWeek = allItems.filter(i => !i.task.done && i.task.endDate && i.task.endDate >= today && i.task.endDate <= workingDayAdd(today, 7));
  const callTasks  = allItems.filter(i => !i.task.done && isCallTask(i.task.title) && (listFilter === "all" || i.task.ownerUid === myUid));

  // Navigation
  function prevPeriod() {
    if (calView === "week") setWeekStart(w => addDays(w, -7));
    else setMonthStart(m => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextPeriod() {
    if (calView === "week") setWeekStart(w => addDays(w, 7));
    else setMonthStart(m => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }
  function goToday() {
    setWeekStart(startOfWeek(new Date()));
    setMonthStart(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  }

  // Period label
  const periodLabel = calView === "week"
    ? `${fmtDate(dateToIso(weekStart))} – ${fmtDate(dateToIso(addDays(weekStart, 6)))}`
    : `${MONTHS[monthStart.getMonth()]} ${monthStart.getFullYear()}`;

  // Save task update
  async function saveTaskUpdate(item, updates) {
    const { engagement, task, stageKey } = item;
    const tasks = [...(engagement.stageTasks?.[stageKey] || [])];
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx === -1) return;
    tasks[idx] = { ...tasks[idx], ...updates };
    const rippled = rippleTasks(tasks);
    await updateDoc(doc(db, "engagements", engagement.id), {
      [`stageTasks.${stageKey}`]: rippled,
      updatedAt: serverTimestamp(),
    });
  }

  async function toggleDone(item) {
    await saveTaskUpdate(item, { done: !item.task.done });
  }

  // Group list by date
  const groupedList = useMemo(() => {
    const sorted = [...filteredItems].sort((a, b) => {
      const da = a.task.startDate || "9999";
      const db_ = b.task.startDate || "9999";
      return da < db_ ? -1 : da > db_ ? 1 : 0;
    });
    const groups = {};
    sorted.forEach(item => {
      const key = item.task.startDate || "No date";
      const label = item.task.startDate === today ? "Today"
        : item.task.startDate === workingDayAdd(today, -1) ? "Yesterday"
        : item.task.startDate === workingDayAdd(today, 1) ? "Tomorrow"
        : item.task.startDate < today ? `${fmtDate(item.task.startDate)} (past)`
        : fmtDate(item.task.startDate) || "No date";
      if (!groups[key]) groups[key] = { label, items: [] };
      groups[key].items.push(item);
    });
    return Object.entries(groups);
  }, [filteredItems, today]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400 }}>
      <Spinner size={28} />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 3px 10px rgba(101,89,255,0.25)",
          }}>
            <Avatar name={user?.displayName} photoURL={user?.photoURL} size={36}
              style={{ borderRadius: 10, border: "2px solid white" }} />
          </div>
          <div>
            <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 2 }}>
              My Dashboard
            </h1>
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {user?.displayName} · {profile?.role?.replace("_", " ")} · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 24 }}>
        {[
          { label: "My open tasks", value: myTasks.length, colour: "var(--purple)", icon: "📋", filter: "mine" },
          { label: "Overdue", value: overdue.length, colour: overdue.length > 0 ? "var(--red)" : "var(--green)", icon: "⚠️", filter: "overdue" },
          { label: "Due this week", value: dueThisWeek.length, colour: dueThisWeek.length > 0 ? "var(--amber)" : "var(--green)", icon: "📅", filter: "upcoming" },
          { label: "Upcoming calls", value: callTasks.length, colour: "var(--blue)", icon: "📹", filter: "calls" },
        ].map(s => (
          <div key={s.label}
            onClick={() => setListFilter(s.filter)}
            style={{
              background: "var(--surface)", border: `1px solid ${listFilter === s.filter ? s.colour : "var(--border)"}`,
              borderRadius: "var(--radius-lg)", padding: "14px 16px", cursor: "pointer",
              transition: "all 0.13s",
              boxShadow: listFilter === s.filter ? `0 0 0 2px ${s.colour}30` : "none",
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "var(--shadow-md)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = listFilter === s.filter ? `0 0 0 2px ${s.colour}30` : "none"}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <Label style={{ marginBottom: 8, display: "block" }}>{s.label}</Label>
                <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 26, color: s.colour }}>{s.value}</p>
              </div>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main two-col layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>

        {/* ── Left: Calendar ── */}
        <div>
          {/* Calendar toolbar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                {periodLabel}
              </h2>
              <button onClick={goToday} style={{
                fontSize: 10, padding: "3px 9px", borderRadius: 999,
                border: "1px solid var(--border)", background: "var(--surface)",
                color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
              }}>Today</button>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <div style={{ display: "flex", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", overflow: "hidden" }}>
                {["week", "month"].map(v => (
                  <button key={v} onClick={() => setCalView(v)} style={{
                    padding: "5px 12px", fontSize: 11, fontWeight: calView === v ? 700 : 400,
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    background: calView === v ? "var(--purple)" : "var(--surface)",
                    color: calView === v ? "white" : "var(--text-second)",
                  }}>
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
              <button onClick={prevPeriod} style={{ padding: "5px 9px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 13 }}>‹</button>
              <button onClick={nextPeriod} style={{ padding: "5px 9px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 13 }}>›</button>
            </div>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow-sm)" }}>
            {calView === "week"
              ? <WeekCalendar tasks={calendarItems} weekStart={weekStart} selectedDay={selectedDay}
                  onDayClick={d => { setSelectedDay(prev => prev === d ? null : d); }}
                  onTaskClick={setEditingItem} />
              : <MonthCalendar tasks={calendarItems} monthStart={monthStart} selectedDay={selectedDay}
                  onDayClick={d => { setSelectedDay(prev => prev === d ? null : d); }}
                  onTaskClick={setEditingItem} />
            }

            {/* Stage legend */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", alignItems: "center" }}>
              {!isManager && (
                <span style={{ fontSize: 10, color: "var(--text-muted)", marginRight: 6 }}>Showing your tasks only</span>
              )}
              {STAGES.map(s => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: stageColour(s.key), flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{s.shortLabel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Task list ── */}
        <div>
          {/* List header + filters */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, color: "var(--text-primary)" }}>
                  {selectedDay ? fmtDate(selectedDay) : "Tasks"}
                </h2>
                {selectedDay && (
                  <button
                    onClick={() => setSelectedDay(null)}
                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, border: "1px solid var(--purple)", background: "var(--purple-light)", color: "var(--purple)", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
                  >
                    × Clear day filter
                  </button>
                )}
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "var(--text-muted)" }}>
                <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)}
                  style={{ accentColor: "var(--purple)", cursor: "pointer" }} />
                Show done
              </label>
            </div>

            {!selectedDay && (
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {[
                { id: "mine",     label: "My tasks" },
                { id: "all",      label: "All" },
                { id: "overdue",  label: "⚠ Overdue" },
                { id: "upcoming", label: "Next 2 weeks" },
                { id: "calls",    label: "📹 Calls" },
              ].map(f => (
                <button key={f.id} onClick={() => { setListFilter(f.id); setSelectedDay(null); }} style={{
                  padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", border: "1px solid var(--border)", fontFamily: "inherit",
                  background: listFilter === f.id ? "var(--purple)" : "var(--surface)",
                  color: listFilter === f.id ? "white" : "var(--text-second)",
                  transition: "all 0.13s",
                }}>
                  {f.label}
                </button>
              ))}
            </div>
            )}
          </div>

          {/* Task list grouped by date */}
          <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto", paddingRight: 2 }}>
            {filteredItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>✓</p>
                <p style={{ fontSize: 13, fontWeight: 500 }}>No tasks here</p>
                <p style={{ fontSize: 11, marginTop: 4 }}>
                  {listFilter === "mine" ? "No open tasks assigned to you" : "All caught up"}
                </p>
              </div>
            ) : (
              groupedList.map(([key, group]) => (
                <div key={key} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
                      color: key < today ? "var(--red)" : key === today ? "var(--purple)" : "var(--text-muted)",
                    }}>
                      {group.label}
                    </span>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{group.items.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {group.items.map((item, i) => (
                      <TaskCard
                        key={item.task.id || i}
                        item={item}
                        users={users}
                        onEdit={setEditingItem}
                        onToggleDone={toggleDone}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Task edit modal ── */}
      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={editingItem ? `${editingItem.task.title}` : ""}
        width={520}
      >
        {editingItem && (
          <TaskEditPanel
            task={editingItem.task}
            engagement={editingItem.engagement}
            users={users}
            onSave={async (updates) => {
              await saveTaskUpdate(editingItem, updates);
              // Refresh the editing item from updated engagements
              setEditingItem(null);
            }}
            onClose={() => setEditingItem(null)}
          />
        )}
      </Modal>
    </div>
  );
}

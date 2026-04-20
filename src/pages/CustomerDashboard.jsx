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
  useToast, ToastContainer,
  COMMENT_TAGS, STAGE_LABELS, CommentEntry, CommentTagPill, CommentRolePill,
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

// ─── Commentary tab component ─────────────────────────────────────────────────
function CommentaryTab({ activityEntries, engagementComments, engagements, onPost, user, profile }) {
  const [commView, setCommView] = useState("timeline");
  const [tagFilter, setTagFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [text, setText] = useState("");
  const [tag, setTag] = useState("");
  const [external, setExternal] = useState(false);
  const [posting, setPosting] = useState(false);

  async function post() {
    if (!text.trim()) return;
    setPosting(true);
    await onPost(text, tag || null, external);
    setText(""); setTag(""); setExternal(false);
    setPosting(false);
  }

  const STAGE_ORDER = ["opportunity","requirements","technical-review","onboarding","solution-delivery","go-live","csm"];

  // Extract task notes from all engagements — flatten to comment-shaped objects
  const taskNotes = engagements.flatMap(eng =>
    STAGE_ORDER.flatMap(stageKey => {
      const tasks = eng.stageTasks?.[stageKey] || [];
      return tasks.flatMap(task =>
        (task.notes || []).map(n => ({
          id: `tasknote-${eng.id}-${stageKey}-${task.title}-${n.at}`,
          text: n.text,
          authorName: n.authorName || null,
          authorPhoto: n.authorPhoto || null,
          authorRole: null,
          tag: null,
          external: false,
          stage: stageKey,
          engagementId: eng.id,
          engagementName: eng.customer,
          taskTitle: task.title,
          _source: "task",
          // Normalise timestamp so sorting works
          createdAt: { toMillis: () => new Date(n.at).getTime() },
        }))
      );
    })
  );

  const customerNotes   = activityEntries.map(e => ({ ...e, _source: "customer", engagementName: null }));
  const engComments     = engagementComments.map(e => ({ ...e, _source: "engagement" }));
  const allComments     = [...customerNotes, ...engComments, ...taskNotes].sort((a, b) => {
    const ta = a.createdAt?.toMillis?.() || new Date(a.createdAt || 0).getTime();
    const tb = b.createdAt?.toMillis?.() || new Date(b.createdAt || 0).getTime();
    return tb - ta;
  });

  const filtered = allComments.filter(e =>
    (!tagFilter  || e.tag  === tagFilter) &&
    (!roleFilter || e.authorRole === roleFilter)
  );

  const roles = [...new Set(allComments.map(e => e.authorRole).filter(Boolean))];

  return (
    <div>
      {/* Composer */}
      <div style={{ background:"var(--surface2)", borderRadius:"var(--radius)", padding:14, marginBottom:16 }}>
        <div style={{ display:"flex", gap:10, marginBottom:10 }}>
          {user?.photoURL
            ? <img src={user.photoURL} style={{ width:28, height:28, borderRadius:"50%", flexShrink:0, marginTop:2, objectFit:"cover" }} alt="" />
            : <Avatar name={user?.displayName} size={28} style={{ flexShrink:0, marginTop:2 }} />
          }
          <Textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Add an account-level note, relationship context, agreed action, escalation..."
            rows={2}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) post(); }}
          />
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {COMMENT_TAGS.map(t => (
              <button key={t.key} onClick={() => setTag(tag === t.key ? "" : t.key)} style={{
                padding:"2px 9px", borderRadius:999, fontSize:11, fontWeight:600, cursor:"pointer",
                border:`1px solid ${tag===t.key ? t.colour : "var(--border)"}`,
                background:tag===t.key ? t.bg : "transparent",
                color:tag===t.key ? t.colour : "var(--text-muted)",
                transition:"all 0.13s",
              }}>{t.label}</button>
            ))}
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:5, fontSize:12, color:"var(--text-muted)", cursor:"pointer", marginLeft:"auto" }}>
            <input type="checkbox" checked={external} onChange={e => setExternal(e.target.checked)} style={{ accentColor:"var(--purple)" }} />
            Communicated externally
          </label>
          <Btn size="sm" onClick={post} disabled={!text.trim() || posting}>
            {posting ? "Posting..." : "Post"}
          </Btn>
        </div>
        {profile?.role && (
          <p style={{ fontSize:11, color:"var(--text-muted)", marginTop:8 }}>
            Logged as <strong>{profile.role}</strong> · Cmd+Enter to post
          </p>
        )}
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", borderRadius:8, overflow:"hidden", border:"1px solid var(--border)" }}>
          {[["timeline","⏱ Timeline"],["by-engagement","📋 By engagement"]].map(([id, label]) => (
            <button key={id} onClick={() => setCommView(id)} style={{
              padding:"6px 14px", fontSize:12, fontWeight:commView===id?600:400, cursor:"pointer",
              background:commView===id?"var(--purple)":"transparent",
              color:commView===id?"white":"var(--text-second)", border:"none", fontFamily:"inherit",
            }}>{label}</button>
          ))}
        </div>
        <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ fontSize:12, padding:"5px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-primary)", fontFamily:"inherit", cursor:"pointer" }}>
          <option value="">All tags</option>
          {COMMENT_TAGS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        {roles.length > 0 && (
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={{ fontSize:12, padding:"5px 10px", borderRadius:8, border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text-primary)", fontFamily:"inherit", cursor:"pointer" }}>
            <option value="">All roles</option>
            {roles.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}
          </select>
        )}
        {(tagFilter || roleFilter) && (
          <button onClick={() => { setTagFilter(""); setRoleFilter(""); }} style={{ fontSize:11, color:"var(--red)", background:"none", border:"1px solid var(--red)", borderRadius:999, padding:"3px 10px", cursor:"pointer", fontFamily:"inherit" }}>Clear</button>
        )}
        <span style={{ fontSize:11, color:"var(--text-muted)", marginLeft:"auto" }}>
          {filtered.length} comment{filtered.length!==1?"s":""}
        </span>
      </div>

      {filtered.length === 0 && (
        <Card style={{ padding:"28px 20px", textAlign:"center" }}>
          <p style={{ fontSize:32, marginBottom:8 }}>💬</p>
          <p style={{ fontSize:14, fontWeight:600, color:"var(--text-primary)", marginBottom:4 }}>No comments yet</p>
          <p style={{ fontSize:13, color:"var(--text-muted)" }}>Comments from engagements and account-level notes will appear here.</p>
        </Card>
      )}

      {/* Timeline */}
      {commView === "timeline" && filtered.length > 0 && (
        <Card style={{ padding:"0 20px" }}>
          {filtered.map(e => <CommentEntry key={e.id+(e._engagementId||"")} entry={e} showEngagement={true} />)}
        </Card>
      )}

      {/* By engagement */}
      {commView === "by-engagement" && filtered.length > 0 && (() => {
        const customerLevel = filtered.filter(e => e._source === "customer");
        const byEng = {};
        filtered.filter(e => e._source === "engagement").forEach(e => {
          const key = e._engagementId || "unknown";
          if (!byEng[key]) byEng[key] = { name: e.engagementName || key, stages: {} };
          const stage = e.stage || "unknown";
          if (!byEng[key].stages[stage]) byEng[key].stages[stage] = [];
          byEng[key].stages[stage].push(e);
        });
        return (
          <div>
            {customerLevel.length > 0 && (
              <div style={{ marginBottom:12, border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
                <div style={{ padding:"10px 18px", background:"var(--surface2)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"var(--text-primary)" }}>🏢 Account-level notes</span>
                  <span style={{ fontSize:11, color:"var(--text-muted)" }}>{customerLevel.length} note{customerLevel.length!==1?"s":""}</span>
                </div>
                <div style={{ padding:"0 18px" }}>
                  {customerLevel.map(e => <CommentEntry key={e.id} entry={e} showEngagement={false} />)}
                </div>
              </div>
            )}
            {Object.entries(byEng).map(([engId, eng]) => (
              <div key={engId} style={{ marginBottom:12, border:"1px solid var(--border)", borderRadius:"var(--radius)", overflow:"hidden" }}>
                <div style={{ padding:"10px 18px", background:"var(--surface2)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"var(--purple)" }}>📋 {eng.name}</span>
                  <span style={{ fontSize:11, color:"var(--text-muted)" }}>{Object.values(eng.stages).flat().length} comment{Object.values(eng.stages).flat().length!==1?"s":""}</span>
                </div>
                {[...STAGE_ORDER, "unknown"].filter(s => eng.stages[s]?.length).map(stage => (
                  <div key={stage}>
                    <div style={{ padding:"6px 18px", background:"var(--surface)", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:"0.06em" }}>
                        🔵 {STAGE_LABELS[stage] || stage}
                      </span>
                      <span style={{ fontSize:10, color:"var(--text-muted)" }}>· {eng.stages[stage].length}</span>
                    </div>
                    <div style={{ padding:"0 18px" }}>
                      {eng.stages[stage].map(e => <CommentEntry key={e.id} entry={e} showEngagement={false} />)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

const OBJECTIVE_STATUSES = [
  { key: "on_track",  label: "On track",  colour: "var(--green)", emoji: "🟢" },
  { key: "at_risk",   label: "At risk",   colour: "var(--amber)", emoji: "🟠" },
  { key: "achieved",  label: "Achieved",  colour: "var(--blue)",  emoji: "✅" },
  { key: "not_started",label:"Not started",colour:"var(--text-muted)",emoji:"⚪"},
];

const CADENCES = ["Monthly", "Bi-monthly", "Quarterly", "Ad hoc"];

const BLANK_SNAPSHOT = {
  qbrLabel: "",         // e.g. "Q2 FY26 QBR"
  qbrDate: "",
  healthStatus: "green",
  healthReason: "",
  objectives: [],       // [{ id, description, status }]
  metrics: [],          // [{ id, description, current, target }]
  milestones: [],       // [{ id, description, targetDate, done }]
  cadence: "Quarterly",
  nextReviewDate: "",
  csmNotes: "",
};

function SuccessPlanTab({ customer, canEdit, user, profile }) {
  const [snapshots, setSnapshots]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeIdx, setActiveIdx]   = useState(0);   // index into snapshots array (0 = latest)
  const [editing, setEditing]       = useState(false);
  const [form, setForm]             = useState(null);
  const [saving, setSaving]         = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newLabel, setNewLabel]     = useState("");
  const [newDate, setNewDate]       = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const q = query(
      collection(db, "customers", customer.id, "successPlan"),
      orderBy("qbrDate", "desc")
    );
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSnapshots(docs);
      setLoading(false);
    });
  }, [customer.id]);

  const current = snapshots[activeIdx] || null;

  function startEdit() {
    setForm({ ...current });
    setEditing(true);
  }

  function cancelEdit() { setEditing(false); setForm(null); }

  function updForm(k, v) { setForm(f => ({ ...f, [k]: v })); }

  // ── Objectives ──
  function addObjective() {
    updForm("objectives", [...(form.objectives || []), { id: Date.now().toString(), description: "", status: "not_started" }]);
  }
  function updObjective(id, k, v) {
    updForm("objectives", form.objectives.map(o => o.id === id ? { ...o, [k]: v } : o));
  }
  function removeObjective(id) {
    updForm("objectives", form.objectives.filter(o => o.id !== id));
  }

  // ── Metrics ──
  function addMetric() {
    updForm("metrics", [...(form.metrics || []), { id: Date.now().toString(), description: "", current: "", target: "" }]);
  }
  function updMetric(id, k, v) {
    updForm("metrics", form.metrics.map(m => m.id === id ? { ...m, [k]: v } : m));
  }
  function removeMetric(id) {
    updForm("metrics", form.metrics.filter(m => m.id !== id));
  }

  // ── Milestones ──
  function addMilestone() {
    updForm("milestones", [...(form.milestones || []), { id: Date.now().toString(), description: "", targetDate: "", done: false }]);
  }
  function updMilestone(id, k, v) {
    updForm("milestones", form.milestones.map(m => m.id === id ? { ...m, [k]: v } : m));
  }
  function removeMilestone(id) {
    updForm("milestones", form.milestones.filter(m => m.id !== id));
  }

  async function saveSnapshot() {
    if (!form) return;
    setSaving(true);
    const data = {
      ...form,
      updatedAt: serverTimestamp(),
      updatedBy: user?.displayName || null,
    };
    await updateDoc(doc(db, "customers", customer.id, "successPlan", current.id), data);
    // Audit
    await addDoc(collection(db, "customers", customer.id, "audit"), {
      text: `Success plan updated: ${current.qbrLabel || "snapshot"}`,
      authorName: user?.displayName || "System", authorUid: user?.uid || null,
      _source: "audit", createdAt: serverTimestamp(),
    });
    setEditing(false); setForm(null); setSaving(false);
  }

  async function createSnapshot() {
    if (!newLabel.trim() || !newDate) return;
    setSaving(true);
    // Copy latest snapshot as base, or start blank
    const base = snapshots[0] ? {
      ...snapshots[0],
      objectives: (snapshots[0].objectives || []).map(o => ({ ...o, status: o.status === "achieved" ? "achieved" : "not_started" })),
      milestones: (snapshots[0].milestones || []).map(m => ({ ...m, done: false })),
    } : { ...BLANK_SNAPSHOT };
    delete base.id;
    const newSnap = {
      ...base,
      qbrLabel: newLabel.trim(),
      qbrDate: newDate,
      csmNotes: "",
      createdBy: user?.displayName || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await addDoc(collection(db, "customers", customer.id, "successPlan"), newSnap);
    await addDoc(collection(db, "customers", customer.id, "audit"), {
      text: `Success plan snapshot created: ${newLabel.trim()}`,
      authorName: user?.displayName || "System", authorUid: user?.uid || null,
      _source: "audit", createdAt: serverTimestamp(),
    });
    setNewLabel(""); setShowNewForm(false); setActiveIdx(0); setSaving(false);
  }

  if (loading) return <div style={{ textAlign: "center", padding: 40 }}><Spinner size={24} /></div>;

  // ── Empty state ──
  if (snapshots.length === 0 && !showNewForm) return (
    <div>
      <Card style={{ padding: "40px 20px", textAlign: "center" }}>
        <p style={{ fontSize: 32, marginBottom: 10 }}>📊</p>
        <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--text-primary)", marginBottom: 6 }}>
          No success plan yet
        </p>
        <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 420, margin: "0 auto 20px" }}>
          Create the first snapshot around the time of the first QBR. Each snapshot captures objectives, metrics, milestones, and health at a point in time — building a history of how this account has progressed.
        </p>
        {canEdit && <Btn onClick={() => setShowNewForm(true)}>+ Create first snapshot</Btn>}
      </Card>
    </div>
  );

  const healthMeta = { green: { emoji: "🟢", label: "Healthy", colour: "var(--green)" }, amber: { emoji: "🟠", label: "At risk", colour: "var(--amber)" }, red: { emoji: "🔴", label: "Off track", colour: "var(--red)" } };

  return (
    <div>
      {/* Snapshot selector + new snapshot button */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)", flexWrap: "wrap" }}>
          {snapshots.map((s, i) => (
            <button key={s.id} onClick={() => { setActiveIdx(i); setEditing(false); }} style={{
              padding: "7px 14px", fontSize: 12, cursor: "pointer", border: "none",
              borderRight: i < snapshots.length - 1 ? "1px solid var(--border)" : "none",
              background: activeIdx === i ? "var(--purple)" : "transparent",
              color: activeIdx === i ? "white" : "var(--text-second)",
              fontWeight: activeIdx === i ? 600 : 400, fontFamily: "inherit",
            }}>
              {s.qbrLabel || s.qbrDate || `Snapshot ${snapshots.length - i}`}
              {i === 0 && <span style={{ marginLeft: 5, fontSize: 9, opacity: 0.8 }}>LATEST</span>}
            </button>
          ))}
        </div>
        {canEdit && !showNewForm && (
          <Btn size="sm" variant="ghost" onClick={() => setShowNewForm(true)}>+ New snapshot</Btn>
        )}
      </div>

      {/* New snapshot form */}
      {showNewForm && (
        <Card style={{ padding: 18, marginBottom: 16 }}>
          <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>New QBR snapshot</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <FieldGroup label="QBR label">
              <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Q2 FY26 QBR" autoFocus />
            </FieldGroup>
            <FieldGroup label="QBR date">
              <Input value={newDate} onChange={e => setNewDate(e.target.value)} type="date" />
            </FieldGroup>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
            {snapshots.length > 0
              ? "Objectives and milestones will be copied from the latest snapshot as a starting point. Achieved objectives are preserved; others reset to Not started."
              : "Starts blank — you can add objectives, metrics and milestones after creating it."}
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" size="sm" onClick={() => setShowNewForm(false)}>Cancel</Btn>
            <Btn size="sm" onClick={createSnapshot} disabled={!newLabel.trim() || !newDate || saving}>
              {saving ? "Creating..." : "Create snapshot"}
            </Btn>
          </div>
        </Card>
      )}

      {/* Current snapshot view / edit */}
      {current && !editing && (
        <div>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 18, color: "var(--text-primary)", marginBottom: 4 }}>
                {current.qbrLabel || "Success Plan"}
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {current.qbrDate && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {new Date(current.qbrDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: healthMeta[current.healthStatus || "green"].colour }}>
                  {healthMeta[current.healthStatus || "green"].emoji} {healthMeta[current.healthStatus || "green"].label}
                </span>
                {current.healthReason && (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>— {current.healthReason}</span>
                )}
              </div>
            </div>
            {canEdit && activeIdx === 0 && (
              <Btn size="sm" variant="ghost" onClick={startEdit}>✎ Edit</Btn>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Objectives */}
            <Card>
              <CardHeader><Label>Business objectives</Label></CardHeader>
              <div style={{ padding: "12px 18px" }}>
                {(current.objectives || []).length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>None set</p>
                ) : (current.objectives || []).map(o => {
                  const st = OBJECTIVE_STATUSES.find(s => s.key === o.status) || OBJECTIVE_STATUSES[3];
                  return (
                    <div key={o.id} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)", alignItems: "flex-start" }}>
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{st.emoji}</span>
                      <p style={{ fontSize: 13, flex: 1, color: "var(--text-primary)", lineHeight: 1.5 }}>{o.description}</p>
                      <span style={{ fontSize: 10, fontWeight: 600, color: st.colour, flexShrink: 0, whiteSpace: "nowrap" }}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Metrics */}
            <Card>
              <CardHeader><Label>Success metrics</Label></CardHeader>
              <div style={{ padding: "12px 18px" }}>
                {(current.metrics || []).length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>None set</p>
                ) : (current.metrics || []).map(m => (
                  <div key={m.id} style={{ padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                    <p style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 3 }}>{m.description}</p>
                    <div style={{ display: "flex", gap: 12 }}>
                      {m.current && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Current: <strong style={{ color: "var(--text-primary)" }}>{m.current}</strong></span>}
                      {m.target  && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Target: <strong style={{ color: "var(--green)" }}>{m.target}</strong></span>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Milestones */}
            <Card>
              <CardHeader><Label>Key milestones</Label></CardHeader>
              <div style={{ padding: "12px 18px" }}>
                {(current.milestones || []).length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>None set</p>
                ) : (current.milestones || []).map(m => (
                  <div key={m.id} style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{m.done ? "✅" : "⭕"}</span>
                    <p style={{ fontSize: 13, flex: 1, color: m.done ? "var(--text-muted)" : "var(--text-primary)", textDecoration: m.done ? "line-through" : "none" }}>
                      {m.description}
                    </p>
                    {m.targetDate && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, whiteSpace: "nowrap" }}>
                        {new Date(m.targetDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Review cadence + CSM notes */}
            <Card>
              <CardHeader><Label>Review & notes</Label></CardHeader>
              <div style={{ padding: "12px 18px" }}>
                {[
                  ["Cadence", current.cadence],
                  ["Next review", current.nextReviewDate ? new Date(current.nextReviewDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null],
                  ["Updated by", current.updatedBy],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{k}</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
                {current.csmNotes && (
                  <p style={{ fontSize: 13, color: "var(--text-second)", marginTop: 12, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{current.csmNotes}</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Edit form */}
      {current && editing && form && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 16, color: "var(--text-primary)" }}>
              Editing: {current.qbrLabel}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Btn>
              <Btn size="sm" onClick={saveSnapshot} disabled={saving}>{saving ? "Saving..." : "Save"}</Btn>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Health */}
            <Card style={{ gridColumn: "1 / -1", padding: 18 }}>
              <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Health</p>
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>
                <FieldGroup label="Status">
                  <Select value={form.healthStatus || "green"} onChange={e => updForm("healthStatus", e.target.value)}>
                    <option value="green">🟢 Healthy</option>
                    <option value="amber">🟠 At risk</option>
                    <option value="red">🔴 Off track</option>
                  </Select>
                </FieldGroup>
                <FieldGroup label="Reason">
                  <Input value={form.healthReason || ""} onChange={e => updForm("healthReason", e.target.value)} placeholder="One line explaining the health status..." />
                </FieldGroup>
              </div>
            </Card>

            {/* Objectives */}
            <Card style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>Business objectives</p>
                <button onClick={addObjective} style={{ fontSize: 11, color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
              </div>
              {(form.objectives || []).map(o => (
                <div key={o.id} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <Input value={o.description} onChange={e => updObjective(o.id, "description", e.target.value)} placeholder="Objective description..." style={{ flex: 1, fontSize: 12 }} />
                  <select value={o.status} onChange={e => updObjective(o.id, "status", e.target.value)} style={{ fontSize: 11, padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", fontFamily: "inherit", width: 110 }}>
                    {OBJECTIVE_STATUSES.map(s => <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>)}
                  </select>
                  <button onClick={() => removeObjective(o.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: "2px 4px", flexShrink: 0 }}>✕</button>
                </div>
              ))}
              {(form.objectives || []).length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No objectives yet — click + Add</p>}
            </Card>

            {/* Metrics */}
            <Card style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>Success metrics</p>
                <button onClick={addMetric} style={{ fontSize: 11, color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
              </div>
              {(form.metrics || []).map(m => (
                <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 80px 20px", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  <Input value={m.description} onChange={e => updMetric(m.id, "description", e.target.value)} placeholder="Metric..." style={{ fontSize: 12 }} />
                  <Input value={m.current} onChange={e => updMetric(m.id, "current", e.target.value)} placeholder="Current" style={{ fontSize: 12 }} />
                  <Input value={m.target}  onChange={e => updMetric(m.id, "target",  e.target.value)} placeholder="Target"  style={{ fontSize: 12 }} />
                  <button onClick={() => removeMetric(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: "2px 0" }}>✕</button>
                </div>
              ))}
              {(form.metrics || []).length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No metrics yet — click + Add</p>}
            </Card>

            {/* Milestones */}
            <Card style={{ padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>Key milestones</p>
                <button onClick={addMilestone} style={{ fontSize: 11, color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
              </div>
              {(form.milestones || []).map(m => (
                <div key={m.id} style={{ display: "grid", gridTemplateColumns: "20px 1fr 110px 20px", gap: 6, marginBottom: 8, alignItems: "center" }}>
                  <input type="checkbox" checked={m.done} onChange={e => updMilestone(m.id, "done", e.target.checked)} style={{ accentColor: "var(--purple)", width: 14, height: 14 }} />
                  <Input value={m.description} onChange={e => updMilestone(m.id, "description", e.target.value)} placeholder="Milestone..." style={{ fontSize: 12 }} />
                  <Input value={m.targetDate} onChange={e => updMilestone(m.id, "targetDate", e.target.value)} type="date" style={{ fontSize: 12 }} />
                  <button onClick={() => removeMilestone(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 14, padding: "2px 0" }}>✕</button>
                </div>
              ))}
              {(form.milestones || []).length === 0 && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No milestones yet — click + Add</p>}
            </Card>

            {/* Review cadence + notes */}
            <Card style={{ padding: 18 }}>
              <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Review & notes</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <FieldGroup label="Review cadence">
                  <Select value={form.cadence || "Quarterly"} onChange={e => updForm("cadence", e.target.value)}>
                    {CADENCES.map(c => <option key={c}>{c}</option>)}
                  </Select>
                </FieldGroup>
                <FieldGroup label="Next review date">
                  <Input value={form.nextReviewDate || ""} onChange={e => updForm("nextReviewDate", e.target.value)} type="date" />
                </FieldGroup>
              </div>
              <FieldGroup label="CSM notes">
                <Textarea value={form.csmNotes || ""} onChange={e => updForm("csmNotes", e.target.value)} placeholder="Anything else relevant — account dynamics, risks, exec relationships..." rows={4} />
              </FieldGroup>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Expansion signals ────────────────────────────────────────────────────────
const SIGNAL_TYPES = [
  { key: "new_use_case",           label: "New use case",           colour: "#6559FF", bg: "rgba(101,89,255,0.12)" },
  { key: "new_team",               label: "New team",               colour: "#00D1FF", bg: "rgba(0,209,255,0.12)"  },
  { key: "seat_expansion",         label: "Seat expansion",         colour: "#00C853", bg: "rgba(0,200,83,0.12)"   },
  { key: "competitor_displacement", label: "Competitor displacement",colour: "#FF7043", bg: "rgba(255,112,67,0.12)" },
  { key: "upsell_opportunity",     label: "Upsell opportunity",     colour: "#FFB300", bg: "rgba(255,179,0,0.12)"  },
  { key: "executive_interest",     label: "Executive interest",     colour: "#AB47BC", bg: "rgba(171,71,188,0.12)" },
];

const SIGNAL_STATUSES = [
  { key: "new",           label: "New",            colour: "var(--purple)"    },
  { key: "shared_ae",     label: "Shared with AE", colour: "var(--blue)"      },
  { key: "in_pipeline",   label: "In pipeline",    colour: "var(--amber)"     },
  { key: "won",           label: "Won",            colour: "var(--green)"     },
  { key: "not_pursued",   label: "Not pursued",    colour: "var(--text-muted)"},
];

function ExpansionSignals({ customer, canEdit, user, profile }) {
  const [showForm, setShowForm] = useState(false);
  const [sigForm, setSigForm]   = useState({ type: "new_use_case", description: "", status: "new" });
  const [saving, setSaving]     = useState(false);

  const signals       = customer.expansionSignals || [];
  const activeSignals = signals.filter(s => s.status !== "not_pursued" && s.status !== "won");
  const closedSignals = signals.filter(s => s.status === "won" || s.status === "not_pursued");

  async function addSignal() {
    if (!sigForm.description.trim()) return;
    setSaving(true);
    const newSignal = {
      id: Date.now().toString(),
      type: sigForm.type,
      description: sigForm.description.trim(),
      status: sigForm.status,
      capturedBy: user?.displayName || "Unknown",
      capturedByRole: profile?.role || null,
      capturedAt: new Date().toISOString(),
    };
    const updated = [...signals, newSignal];
    await updateDoc(doc(db, "customers", customer.id), {
      expansionSignals: updated, updatedAt: serverTimestamp(),
    });
    await addDoc(collection(db, "customers", customer.id, "audit"), {
      text: `Expansion signal captured: ${SIGNAL_TYPES.find(t => t.key === sigForm.type)?.label} — "${sigForm.description.trim()}"`,
      authorName: user?.displayName || "System", authorUid: user?.uid || null,
      _source: "audit", createdAt: serverTimestamp(),
    });
    setSigForm({ type: "new_use_case", description: "", status: "new" });
    setShowForm(false);
    setSaving(false);
  }

  async function updateSignalStatus(sigId, newStatus) {
    const updated = signals.map(s => s.id === sigId ? { ...s, status: newStatus } : s);
    await updateDoc(doc(db, "customers", customer.id), {
      expansionSignals: updated, updatedAt: serverTimestamp(),
    });
    const sig = signals.find(s => s.id === sigId);
    const statusLabel = SIGNAL_STATUSES.find(s => s.key === newStatus)?.label || newStatus;
    await addDoc(collection(db, "customers", customer.id, "audit"), {
      text: `Expansion signal status: "${sig?.description?.slice(0, 60)}" → ${statusLabel}`,
      authorName: user?.displayName || "System", authorUid: user?.uid || null,
      _source: "audit", createdAt: serverTimestamp(),
    });
  }

  async function removeSignal(sigId) {
    await updateDoc(doc(db, "customers", customer.id), {
      expansionSignals: signals.filter(s => s.id !== sigId), updatedAt: serverTimestamp(),
    });
  }

  return (
    <Card style={{ gridColumn: "1 / -1" }}>
      <CardHeader>
        <Label>Expansion signals</Label>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {signals.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {activeSignals.length} active{closedSignals.length > 0 ? ` · ${closedSignals.length} closed` : ""}
            </span>
          )}
          {canEdit && (
            <button onClick={() => setShowForm(f => !f)} style={{
              fontSize: 11, padding: "3px 10px", borderRadius: 6,
              border: "1px solid var(--border)", background: showForm ? "var(--purple-light)" : "transparent",
              color: showForm ? "var(--purple)" : "var(--text-muted)", cursor: "pointer", fontFamily: "inherit",
            }}>
              {showForm ? "✕ Cancel" : "+ Add signal"}
            </button>
          )}
        </div>
      </CardHeader>

      {/* Add form */}
      {showForm && (
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <Label style={{ marginBottom: 5, display: "block" }}>Signal type</Label>
              <Select value={sigForm.type} onChange={e => setSigForm(f => ({ ...f, type: e.target.value }))}>
                {SIGNAL_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </Select>
            </div>
            <div>
              <Label style={{ marginBottom: 5, display: "block" }}>Status</Label>
              <Select value={sigForm.status} onChange={e => setSigForm(f => ({ ...f, status: e.target.value }))}>
                {SIGNAL_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </Select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <Label style={{ marginBottom: 5, display: "block" }}>Description</Label>
            <Input
              value={sigForm.description}
              onChange={e => setSigForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What was said, by whom, in what context..."
              onKeyDown={e => { if (e.key === "Enter") addSignal(); }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Btn size="sm" onClick={addSignal} disabled={!sigForm.description.trim() || saving}>
              {saving ? "Saving..." : "Save signal"}
            </Btn>
          </div>
        </div>
      )}

      {/* Signal list */}
      {signals.length === 0 && !showForm ? (
        <div style={{ padding: "20px 18px", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>No expansion signals captured yet.</p>
          {canEdit && (
            <button onClick={() => setShowForm(true)} style={{ fontSize: 12, color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              + Capture first signal →
            </button>
          )}
        </div>
      ) : (
        <div>
          {activeSignals.map((sig, i) => {
            const typeMeta   = SIGNAL_TYPES.find(t => t.key === sig.type) || SIGNAL_TYPES[0];
            const statusMeta = SIGNAL_STATUSES.find(s => s.key === sig.status) || SIGNAL_STATUSES[0];
            const capturedDate = sig.capturedAt
              ? new Date(sig.capturedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
              : "—";
            return (
              <div key={sig.id} style={{
                display: "flex", gap: 12, padding: "12px 18px", alignItems: "flex-start",
                borderBottom: (i < activeSignals.length - 1 || closedSignals.length > 0) ? "1px solid var(--border)" : "none",
              }}>
                <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 9px", borderRadius:999, fontSize:11, fontWeight:700, background:typeMeta.bg, color:typeMeta.colour, flexShrink:0, marginTop:2, whiteSpace:"nowrap" }}>
                  {typeMeta.label}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 4, lineHeight: 1.5 }}>{sig.description}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {sig.capturedBy}{sig.capturedByRole ? ` (${sig.capturedByRole.toUpperCase()})` : ""} · {capturedDate}
                    </span>
                    {canEdit ? (
                      <select value={sig.status} onChange={e => updateSignalStatus(sig.id, e.target.value)} style={{ fontSize:11, padding:"1px 6px", borderRadius:6, border:"1px solid var(--border)", background:"transparent", color:statusMeta.colour, cursor:"pointer", fontFamily:"inherit", fontWeight:600 }}>
                        {SIGNAL_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    ) : (
                      <span style={{ fontSize:11, fontWeight:600, color:statusMeta.colour }}>{statusMeta.label}</span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => removeSignal(sig.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text-muted)", fontSize:14, padding:"2px 4px", flexShrink:0 }} title="Remove">✕</button>
                )}
              </div>
            );
          })}
          {closedSignals.length > 0 && (
            <div style={{ padding: "10px 18px", background: "var(--surface2)" }}>
              <p style={{ fontSize:11, color:"var(--text-muted)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>
                Closed ({closedSignals.length})
              </p>
              {closedSignals.map(sig => {
                const typeMeta   = SIGNAL_TYPES.find(t => t.key === sig.type) || SIGNAL_TYPES[0];
                const statusMeta = SIGNAL_STATUSES.find(s => s.key === sig.status) || SIGNAL_STATUSES[0];
                return (
                  <div key={sig.id} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:6, opacity:0.65 }}>
                    <span style={{ fontSize:10, padding:"1px 7px", borderRadius:999, background:typeMeta.bg, color:typeMeta.colour, fontWeight:600, flexShrink:0 }}>{typeMeta.label}</span>
                    <span style={{ fontSize:12, color:"var(--text-muted)", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sig.description}</span>
                    <span style={{ fontSize:11, fontWeight:600, color:statusMeta.colour, flexShrink:0 }}>{statusMeta.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

const STAKEHOLDER_TIERS = [
  { key: "executive",    label: "Executive",    colour: "#FF7043", bg: "rgba(255,112,67,0.12)" },
  { key: "operational",  label: "Operational",  colour: "#00C853", bg: "rgba(0,200,83,0.12)"   },
  { key: "procurement",  label: "Procurement",  colour: "#FFB300", bg: "rgba(255,179,0,0.12)"  },
  { key: "technical",    label: "Technical",    colour: "#00D1FF", bg: "rgba(0,209,255,0.12)"  },
  { key: "other",        label: "Other",        colour: "#78909C", bg: "rgba(120,144,156,0.12)"},
];

const STAKEHOLDER_OWNERS = [
  { key: "ae",  label: "AE"  },
  { key: "csm", label: "CSM" },
  { key: "cse", label: "CSE" },
  { key: "com", label: "COM" },
];

const BLANK_STAKEHOLDER = {
  name: "", title: "", tier: "operational", owner: "csm", lastContacted: "", note: "",
};

function StakeholdersTab({ customer, canEdit, user }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(BLANK_STAKEHOLDER);
  const [editId, setEditId]     = useState(null);
  const [saving, setSaving]     = useState(false);

  const stakeholders = customer.stakeholders || [];

  function upd(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function startEdit(s) {
    setForm({ name: s.name, title: s.title || "", tier: s.tier || "operational", owner: s.owner || "csm", lastContacted: s.lastContacted || "", note: s.note || "" });
    setEditId(s.id);
    setShowForm(true);
  }

  function cancelForm() { setShowForm(false); setEditId(null); setForm(BLANK_STAKEHOLDER); }

  async function saveStakeholder() {
    if (!form.name.trim()) return;
    setSaving(true);
    let updated;
    if (editId) {
      updated = stakeholders.map(s => s.id === editId ? { ...s, ...form } : s);
    } else {
      updated = [...stakeholders, { ...form, id: Date.now().toString(), addedBy: user?.displayName || null, addedAt: new Date().toISOString() }];
    }
    await updateDoc(doc(db, "customers", customer.id), { stakeholders: updated, updatedAt: serverTimestamp() });
    cancelForm();
    setSaving(false);
  }

  async function removeStakeholder(id) {
    await updateDoc(doc(db, "customers", customer.id), {
      stakeholders: stakeholders.filter(s => s.id !== id), updatedAt: serverTimestamp(),
    });
  }

  // Group by tier for display
  const byTier = STAKEHOLDER_TIERS.map(t => ({
    ...t,
    items: stakeholders.filter(s => (s.tier || "other") === t.key),
  })).filter(t => t.items.length > 0 || (showForm && !editId));

  return (
    <div>
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, color: "var(--text-primary)", marginBottom: 2 }}>
            Stakeholder map
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {stakeholders.length} contact{stakeholders.length !== 1 ? "s" : ""} · who to engage, who owns the relationship, when last contacted
          </p>
        </div>
        {canEdit && (
          <Btn size="sm" onClick={() => { cancelForm(); setShowForm(f => !f); }}>
            {showForm && !editId ? "✕ Cancel" : "+ Add contact"}
          </Btn>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <Card style={{ marginBottom: 16, padding: 18 }}>
          <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 14 }}>
            {editId ? "Edit contact" : "Add contact"}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <FieldGroup label="Name">
              <Input value={form.name} onChange={e => upd("name", e.target.value)} placeholder="e.g. Sarah Chen" autoFocus />
            </FieldGroup>
            <FieldGroup label="Job title">
              <Input value={form.title} onChange={e => upd("title", e.target.value)} placeholder="e.g. Head of EHS" />
            </FieldGroup>
            <FieldGroup label="Seniority tier">
              <Select value={form.tier} onChange={e => upd("tier", e.target.value)}>
                {STAKEHOLDER_TIERS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </Select>
            </FieldGroup>
            <FieldGroup label="Relationship owner">
              <Select value={form.owner} onChange={e => upd("owner", e.target.value)}>
                {STAKEHOLDER_OWNERS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </Select>
            </FieldGroup>
            <FieldGroup label="Last contacted">
              <Input value={form.lastContacted} onChange={e => upd("lastContacted", e.target.value)} type="date" />
            </FieldGroup>
            <FieldGroup label="Note (optional)">
              <Input value={form.note} onChange={e => upd("note", e.target.value)} placeholder="Context, relationship quality, next step..." />
            </FieldGroup>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Btn variant="ghost" size="sm" onClick={cancelForm}>Cancel</Btn>
            <Btn size="sm" onClick={saveStakeholder} disabled={!form.name.trim() || saving}>
              {saving ? "Saving..." : editId ? "Save changes" : "Add contact"}
            </Btn>
          </div>
        </Card>
      )}

      {/* Empty state */}
      {stakeholders.length === 0 && !showForm && (
        <Card style={{ padding: "40px 20px", textAlign: "center" }}>
          <p style={{ fontSize: 32, marginBottom: 10 }}>👥</p>
          <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--text-primary)", marginBottom: 6 }}>
            No stakeholders mapped yet
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 380, margin: "0 auto 16px" }}>
            Map the key contacts at this account — who owns which relationship, when they were last engaged, and what level of seniority they represent.
          </p>
          {canEdit && <Btn onClick={() => setShowForm(true)}>+ Add first contact</Btn>}
        </Card>
      )}

      {/* Grouped by tier */}
      {stakeholders.length > 0 && STAKEHOLDER_TIERS.filter(t => stakeholders.some(s => (s.tier || "other") === t.key)).map(tier => {
        const items = stakeholders.filter(s => (s.tier || "other") === tier.key);
        return (
          <div key={tier.key} style={{ marginBottom: 12 }}>
            {/* Tier header */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: tier.colour, flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: tier.colour, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {tier.label}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>· {items.length}</span>
            </div>

            {/* Contact cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
              {items.map(s => {
                const ownerMeta = STAKEHOLDER_OWNERS.find(o => o.key === s.owner);
                const daysSince = s.lastContacted
                  ? Math.floor((Date.now() - new Date(s.lastContacted)) / 86400000)
                  : null;
                const contactColour = daysSince === null ? "var(--text-muted)"
                  : daysSince > 60 ? "var(--red)"
                  : daysSince > 30 ? "var(--amber)"
                  : "var(--green)";
                return (
                  <div key={s.id} style={{
                    background: "var(--surface2)", border: `1px solid ${tier.colour}30`,
                    borderRadius: "var(--radius)", padding: "14px 16px",
                    position: "relative",
                  }}>
                    {/* Actions */}
                    {canEdit && (
                      <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 4 }}>
                        <button onClick={() => startEdit(s)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: "2px 5px", borderRadius: 4 }} title="Edit">✎</button>
                        <button onClick={() => removeStakeholder(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: "2px 5px", borderRadius: 4 }} title="Remove">✕</button>
                      </div>
                    )}

                    {/* Name + title */}
                    <p style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", marginBottom: 2, paddingRight: 40 }}>{s.name}</p>
                    {s.title && <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>{s.title}</p>}

                    {/* Meta row */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: s.note ? 8 : 0 }}>
                      {/* Owner badge */}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 999,
                        background: "var(--surface)", border: "1px solid var(--border)",
                        color: "var(--text-second)", textTransform: "uppercase", letterSpacing: "0.05em",
                      }}>
                        {ownerMeta?.label || s.owner} owned
                      </span>
                      {/* Last contact */}
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999,
                        background: "var(--surface)", border: `1px solid ${contactColour}44`,
                        color: contactColour,
                      }}>
                        {daysSince === null ? "Not yet contacted"
                          : daysSince === 0 ? "Contacted today"
                          : `Last contact ${daysSince}d ago`}
                      </span>
                    </div>

                    {/* Note */}
                    {s.note && (
                      <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 6, fontStyle: "italic" }}>
                        "{s.note}"
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
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
  // Audit trail — auto-written system events
  const [auditEntries, setAuditEntries] = useState([]);
  // Commentary — engagement-level comments across all linked engagements
  const [engagementComments, setEngagementComments] = useState([]); // flat array from all engagements

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
    // Customer activity log (manual commentary)
    const u4 = onSnapshot(
      query(collection(db, "customers", customer.id, "activity"), orderBy("createdAt", "desc")),
      s => setActivityEntries(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    // Audit trail (system-written events)
    const u5 = onSnapshot(
      query(collection(db, "customers", customer.id, "audit"), orderBy("createdAt", "desc")),
      s => setAuditEntries(s.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [customer?.id, customer?.name]);

  // Subscribe to engagement-level comments for all linked engagements
  useEffect(() => {
    if (!engagements.length) { setEngagementComments([]); return; }
    const unsubs = engagements.map(eng =>
      onSnapshot(
        query(collection(db, "engagements", eng.id, "activity"), orderBy("createdAt", "desc")),
        snap => {
          const entries = snap.docs.map(d => ({ id: d.id, ...d.data(), _engagementId: eng.id }));
          setEngagementComments(prev => {
            const filtered = prev.filter(e => e._engagementId !== eng.id);
            return [...filtered, ...entries];
          });
        }
      )
    );
    return () => unsubs.forEach(u => u());
  }, [engagements.map(e => e.id).join(",")]); // re-subscribe when engagement list changes

  async function postActivity(text, tag = null, external = false) {
    if (!text?.trim() || !user) return;
    await addDoc(collection(db, "customers", customer.id, "activity"), {
      text:        text.trim(),
      authorName:  user.displayName,
      authorPhoto: user.photoURL,
      authorUid:   user.uid,
      authorRole:  profile?.role || null,
      tag:         tag || null,
      external:    external,
      _source:     "customer",
      createdAt:   serverTimestamp(),
    });
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
        { id: "overview",      label: "Overview" },
        { id: "stakeholders",  label: "Stakeholders" },
        { id: "success-plan",  label: "Success Plan" },
        { id: "integrations",  label: "Integrations", badge: integrations.length || null },
        { id: "tickets",       label: "Request history", badge: openTickets.length || null },
        { id: "engagements",   label: "Engagements", badge: engagements.length || null },
        { id: "commentary",    label: "Commentary" },
        { id: "activity",      label: "Activity log" },
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

          {/* Renewal */}
          {(() => {
            const RENEWAL_META = {
              on_track:        { emoji: "🟢", label: "On track",        colour: "var(--green)" },
              at_risk:         { emoji: "🟠", label: "At risk",         colour: "var(--amber)" },
              needs_attention: { emoji: "🔴", label: "Needs attention", colour: "var(--red)"   },
              not_renewing:    { emoji: "⚫", label: "Not renewing",    colour: "var(--text-muted)" },
            };
            const rMeta = RENEWAL_META[customer.renewalStatus || "on_track"];
            const hasRenewal = customer.renewalDate || customer.renewalARR;
            const daysUntil = customer.renewalDate
              ? Math.ceil((new Date(customer.renewalDate) - new Date()) / 86400000)
              : null;
            return (
              <Card style={{ gridColumn: "1 / -1" }}>
                <CardHeader>
                  <Label>Renewal</Label>
                  {hasRenewal && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>manual entry · Salesforce sync coming</span>}
                  {canEdit && onEditCustomer && (
                    <button onClick={() => onEditCustomer(customer)} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit" }}>
                      ✎ Edit
                    </button>
                  )}
                </CardHeader>
                {!hasRenewal ? (
                  <div style={{ padding: "16px 18px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No renewal data set.</p>
                    {canEdit && onEditCustomer && (
                      <button onClick={() => onEditCustomer(customer)} style={{ marginTop: 8, fontSize: 12, color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                        + Add renewal date →
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 0 }}>
                    {[
                      ["Renewal date", customer.renewalDate
                        ? `${new Date(customer.renewalDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}${daysUntil !== null ? ` · ${daysUntil <= 0 ? "overdue" : `${daysUntil}d away`}` : ""}`
                        : "—"],
                      ["Renewal ARR", customer.renewalARR ? `£${Number(customer.renewalARR).toLocaleString()}` : customer.arr ? `£${Number(customer.arr).toLocaleString()} (current ARR)` : "—"],
                      ["Status", `${rMeta.emoji} ${rMeta.label}`],
                    ].map(([k, v], i) => (
                      <div key={k} style={{ padding: "14px 18px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
                        <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{k}</p>
                        <p style={{ fontSize: 14, fontWeight: 600, color: k === "Status" ? rMeta.colour : "var(--text-primary)" }}>{v}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })()}

          {/* Expansion signals */}
          <ExpansionSignals customer={customer} canEdit={canEdit} user={user} profile={profile} />

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

      {/* ── SUCCESS PLAN ── */}
      {tab === "success-plan" && (
        <SuccessPlanTab customer={customer} canEdit={canEdit} user={user} profile={profile} />
      )}

      {/* ── STAKEHOLDERS ── */}
      {tab === "stakeholders" && (
        <StakeholdersTab customer={customer} canEdit={canEdit} user={user} profile={profile} />
      )}

      {/* ── COMMENTARY ── */}
      {tab === "commentary" && (
        <CommentaryTab
          activityEntries={activityEntries}
          engagementComments={engagementComments}
          engagements={engagements}
          onPost={postActivity}
          user={user}
          profile={profile}
        />
      )}

      {/* ── ACTIVITY LOG (audit trail) ── */}
      {tab === "activity" && (
        <div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
            Automatic record of field changes, stage advances, and system events. Not editable.
          </p>
          {auditEntries.length === 0 ? (
            <Card style={{ padding: "32px 20px", textAlign: "center" }}>
              <p style={{ fontSize: 28, marginBottom: 8 }}>🔍</p>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>No audit events yet</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Events are recorded automatically when fields change, stages advance, or records are created.
              </p>
            </Card>
          ) : (
            <Card style={{ padding: "0 20px" }}>
              {auditEntries.map((entry, i) => {
                const ts = entry.createdAt?.toDate ? entry.createdAt.toDate() : new Date(entry.createdAt || 0);
                return (
                  <div key={entry.id} style={{
                    display: "flex", gap: 12, padding: "12px 0",
                    borderBottom: i < auditEntries.length - 1 ? "1px solid var(--border)" : "none",
                    alignItems: "flex-start",
                  }}>
                    {/* System icon or user avatar */}
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                    }}>
                      {entry.authorName === "System" ? "⚙" : (entry.authorName?.[0] || "?")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-second)" }}>
                          {entry.authorName || "System"}
                        </span>
                        {entry.engagementName && (
                          <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--surface2)", padding: "1px 7px", borderRadius: 999 }}>
                            📋 {entry.engagementName}
                          </span>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                          {ts.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          {" · "}
                          {ts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{entry.text}</p>
                    </div>
                  </div>
                );
              })}
            </Card>
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

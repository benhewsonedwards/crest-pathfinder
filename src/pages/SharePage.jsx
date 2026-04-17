import { useState, useEffect } from "react";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";
import { STAGES, STAGE_KEYS, RAG_STATUSES, TASK_TEMPLATES, stageColour, fmtDate } from "../lib/constants";
import { integrationStatus, TICKET_TYPES, ticketType } from "../lib/integrationConstants";
import { Spinner } from "../components/UI";

const LABEL_W = 140; // px — must match label span width below

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

  return (
    <div style={{ overflowX: "auto", paddingBottom: 4 }}>
      <div style={{ minWidth: 420 }}>
        {dated.map((t, i) => {
          const colour = stageColour(t.stageKey);
          const x1 = xPct(t.startDate || t.endDate);
          const x2 = xPct(t.endDate || t.startDate);
          const w = Math.max(x2 - x1, 1.5);
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", marginBottom: 5 }}>
              <span style={{ fontSize: 10, color: "#6B7280", width: LABEL_W, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{t.title}</span>
              {/* Bar area — today line lives here, not in the label */}
              <div style={{ flex: 1, position: "relative", height: 16, background: "#F3F4F6", borderRadius: 4 }}>
                {showToday && (
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: `${todayPct}%`, width: 1.5, background: "#D97706", zIndex: 2, opacity: 0.85 }} />
                )}
                <div style={{
                  position: "absolute", left: `${x1}%`, width: `${w}%`, height: "100%",
                  background: t.done ? colour + "50" : colour + "80",
                  borderRadius: 4, borderLeft: `2px solid ${colour}`,
                }} />
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

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const st = integrationStatus(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 10px", borderRadius: 999, background: st.bg, color: st.colour, fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.colour }} />
      {st.label}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SharePage({ customerId }) {
  const [customer, setCustomer] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!customerId) { setNotFound(true); setLoading(false); return; }
    (async () => {
      try {
        // Load customer
        const snap = await getDoc(doc(db, "customers", customerId));
        if (!snap.exists() || !snap.data().shareEnabled) { setNotFound(true); setLoading(false); return; }
        const cust = { id: snap.id, ...snap.data() };
        setCustomer(cust);

        // Load integrations
        const iSnap = await getDocs(query(collection(db, "integrations"), where("customerId", "==", customerId)));
        setIntegrations(iSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Load engagements
        const eSnap = await getDocs(query(collection(db, "engagements"), where("customerId", "==", customerId)));
        const eSnap2 = await getDocs(query(collection(db, "engagements"), where("customer", "==", cust.name)));
        const allEngs = [...eSnap.docs, ...eSnap2.docs.filter(d => !eSnap.docs.find(e => e.id === d.id))]
          .map(d => ({ id: d.id, ...d.data() }));
        setEngagements(allEngs);
      } catch (e) {
        console.error(e);
        setNotFound(true);
      }
      setLoading(false);
    })();
  }, [customerId]);

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F7FB" }}>
      <div style={{ textAlign: "center" }}>
        <Spinner size={28} />
        <p style={{ marginTop: 12, fontSize: 13, color: "#9CA3AF" }}>Loading...</p>
      </div>
    </div>
  );

  if (notFound) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F7FB" }}>
      <div style={{ textAlign: "center", maxWidth: 400, padding: 32 }}>
        <p style={{ fontSize: 48, marginBottom: 16 }}>🔒</p>
        <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 20, color: "#111827", marginBottom: 8 }}>This page isn't available</h1>
        <p style={{ fontSize: 14, color: "#6B7280" }}>This customer view either doesn't exist or hasn't been shared publicly.</p>
      </div>
    </div>
  );

  const latestEngagement = engagements.sort((a, b) =>
    STAGE_KEYS.indexOf(b.currentStage) - STAGE_KEYS.indexOf(a.currentStage)
  )[0];
  const allTickets = integrations.flatMap(i => (i.tickets || []).map(t => ({ ...t, integrationName: i.name })));
  const openTickets = allTickets.filter(t => t.status !== "done");
  const liveInts = integrations.filter(i => i.status === "live" || i.status === "live-attention");

  const S = { // local styles
    card: { background: "#FFFFFF", border: "1px solid #E4E7EF", borderRadius: 14, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
    cardHead: { padding: "12px 20px", borderBottom: "1px solid #E4E7EF", background: "#F8F9FC", display: "flex", alignItems: "center", justifyContent: "space-between" },
    label: { fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "#9CA3AF" },
    row: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid #F3F4F6", fontSize: 13 },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F5F7FB", fontFamily: "'Noto Sans', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Noto+Sans:wght@400;500;600&display=swap');`}</style>

      {/* Header */}
      <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E4E7EF", padding: "16px 32px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, #6559FF, #8B80FF)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L4 6.5V11C4 15.1 7 18.9 11 20C15 18.9 18 15.1 18 11V6.5L11 2Z" fill="white" fillOpacity="0.9"/>
            <path d="M8 11L10 13L14 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 14, color: "#111827", lineHeight: 1.1 }}>CREST Pathfinder</p>
          <p style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.07em" }}>CUSTOMER VIEW — CONFIDENTIAL</p>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 16, color: "#111827" }}>{customer.name}</p>
          <p style={{ fontSize: 12, color: "#6B7280" }}>{[customer.segment, customer.region, customer.subscription].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 20px 48px" }}>

        {/* Summary stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Integrations", value: integrations.length, colour: "#6559FF" },
            { label: "Live now", value: liveInts.length, colour: "#16A34A" },
            { label: "Open requests", value: openTickets.length, colour: openTickets.length > 0 ? "#D97706" : "#16A34A" },
            { label: "Engagements", value: engagements.length, colour: "#0EA5E9" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1px solid #E4E7EF", borderRadius: 12, padding: "14px 16px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 26, color: s.colour }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "#6B7280", marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Onboarding progress */}
        {latestEngagement && (() => {
          const ragObj = RAG_STATUSES.find(r => r.key === latestEngagement.ragStatus) || RAG_STATUSES[0];
          return (
            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827" }}>Onboarding progress</span>
                <span style={{ fontSize: 12, color: ragObj.colour, fontWeight: 600 }}>{ragObj.emoji} {ragObj.label}</span>
              </div>
              <div style={{ padding: "16px 20px" }}>
                {/* Stage pipeline */}
                <div style={{ display: "flex", marginBottom: 16 }}>
                  {STAGES.map((s, i) => {
                    const isCurrent = s.key === latestEngagement.currentStage;
                    const isPast = STAGE_KEYS.indexOf(s.key) < STAGE_KEYS.indexOf(latestEngagement.currentStage);
                    const colour = s.colour;
                    return (
                      <div key={s.key} style={{ flex: 1, textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {i > 0 && <div style={{ flex: 1, height: 2, background: isPast ? colour + "80" : "#E4E7EF" }} />}
                          <div style={{
                            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                            background: isCurrent ? colour : isPast ? colour + "20" : "#F3F4F6",
                            border: `2px solid ${isCurrent ? colour : isPast ? colour + "40" : "#E4E7EF"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, color: isCurrent ? "white" : colour,
                            fontWeight: 700,
                          }}>
                            {isPast ? "✓" : i + 1}
                          </div>
                          {i < STAGES.length - 1 && <div style={{ flex: 1, height: 2, background: "#E4E7EF" }} />}
                        </div>
                        <p style={{ fontSize: 9, marginTop: 5, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? colour : isPast ? "#6B7280" : "#9CA3AF" }}>{s.shortLabel}</p>
                      </div>
                    );
                  })}
                </div>
                {/* Gantt */}
                {latestEngagement.stageTasks && <MiniGantt stageTasks={latestEngagement.stageTasks} />}
              </div>
            </div>
          );
        })()}

        {/* Integration portfolio */}
        {integrations.length > 0 && (
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827" }}>Integration portfolio</span>
              <span style={{ fontSize: 12, color: "#6B7280" }}>{integrations.length} integration{integrations.length !== 1 ? "s" : ""}</span>
            </div>
            {integrations.map((integ, i) => (
              <div key={integ.id} style={{ padding: "14px 20px", borderBottom: i < integrations.length - 1 ? "1px solid #F3F4F6" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{integ.name}</span>
                  <StatusBadge status={integ.status} />
                  <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>{integ.category}</span>
                </div>
                {integ.problemStatement && (
                  <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6, marginBottom: 6 }}>{integ.problemStatement}</p>
                )}
                <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6B7280" }}>
                  {integ.sourceSystem && <span>{integ.sourceSystem} → {integ.targetSystem}</span>}
                  {integ.dataDirection && <span>{integ.dataDirection}</span>}
                </div>
                {/* Version note */}
                {(integ.versionHistory || []).length > 0 && (() => {
                  const latest = integ.versionHistory[integ.versionHistory.length - 1];
                  return <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>v{latest.version} — {latest.description}</p>;
                })()}
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
                  <span style={{ fontSize: 11, color: "#6B7280" }}>{t.integrationName}</span>
                  {t.jiraKey && (
                    <a href={`https://safetyculture.atlassian.net/browse/${t.jiraKey}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: "#6559FF", fontWeight: 600 }}>{t.jiraKey} →</a>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Your actions */}
        {latestEngagement && (() => {
          const customerTasks = [];
          STAGE_KEYS.forEach(sk => {
            const stored = latestEngagement.stageTasks?.[sk];
            if (stored && stored.length > 0) {
              stored
                .filter(t => t.owner === "customer" || t.ownerRole === "customer")
                .forEach(t => customerTasks.push({ ...t, stageKey: sk }));
            } else {
              (TASK_TEMPLATES[sk] || [])
                .filter(t => t.owner === "customer")
                .forEach(t => customerTasks.push({
                  title: t.title, stageKey: sk,
                  owner: "customer", ownerRole: "customer",
                  customerNote: t.customerNote || null,
                  done: false, startDate: null, endDate: null,
                }));
            }
          });
          if (!customerTasks.length) return null;
          const pending = customerTasks.filter(t => !t.done);
          return (
            <div style={S.card}>
              <div style={S.cardHead}>
                <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827" }}>
                  Your actions
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: pending.length > 0 ? "#D97706" : "#16A34A" }}>
                  {pending.length > 0 ? `${pending.length} pending` : "✓ All complete"}
                </span>
              </div>
              {customerTasks.map((t, i) => {
                const stage = STAGES.find(s => s.key === t.stageKey);
                return (
                  <div key={i} style={{
                    display: "flex", gap: 14, padding: "14px 20px",
                    borderBottom: i < customerTasks.length - 1 ? "1px solid #F3F4F6" : "none",
                    opacity: t.done ? 0.55 : 1,
                  }}>
                    {/* Status circle */}
                    <div style={{ paddingTop: 2, flexShrink: 0 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%",
                        background: t.done ? "#16A34A" : "#F3F4F6",
                        border: `2px solid ${t.done ? "#16A34A" : "#D1D5DB"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {t.done && <span style={{ fontSize: 10, color: "white", fontWeight: 700 }}>✓</span>}
                      </div>
                    </div>
                    {/* Text */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", textDecoration: t.done ? "line-through" : "none" }}>
                          {t.title}
                        </p>
                        {stage && (
                          <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 999, background: stage.colour + "18", color: stage.colour, fontWeight: 600 }}>
                            {stage.shortLabel}
                          </span>
                        )}
                      </div>
                      {t.customerNote && (
                        <p style={{ fontSize: 12, color: "#4B5563", lineHeight: 1.65 }}>{t.customerNote}</p>
                      )}
                      {(t.startDate || t.endDate) && (
                        <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 5 }}>
                          {t.startDate && `Start: ${fmtDate(t.startDate)}`}
                          {t.startDate && t.endDate && " · "}
                          {t.endDate && `Due: ${fmtDate(t.endDate)}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Account team */}
        {(customer.csmName || customer.comName) && (
          <div style={S.card}>
            <div style={S.cardHead}>
              <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: "#111827" }}>Your SafetyCulture team</span>
            </div>
            <div style={{ padding: "14px 20px", display: "flex", gap: 20 }}>
              {[["Customer Success Manager", customer.csmName], ["Customer Onboarding Manager", customer.comName], ["Account Executive", customer.aeName]].filter(([, v]) => v).map(([role, name]) => (
                <div key={role}>
                  <p style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{role}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{name}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#9CA3AF", marginTop: 24 }}>
          This view is confidential and intended for {customer.name} only · Powered by CREST Pathfinder · SafetyCulture
        </p>
      </div>
    </div>
  );
}

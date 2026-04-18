import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { STAGES, STAGE_KEYS, RAG_STATUSES, fmtDate, timeAgo } from "../lib/constants";
import { Card, CardHeader, Label, Pill, Avatar, EmptyState, Btn, Spinner, useSortable, SortableHeader } from "../components/UI";

function StatCard({ label, value, colour, icon }) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: "var(--radius-lg)",
      border: "1px solid var(--border)", padding: "18px 20px",
      boxShadow: "var(--shadow-sm)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <Label style={{ marginBottom: 8, display: "block" }}>{label}</Label>
          <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 28, color: colour || "var(--text-primary)" }}>
            {value}
          </p>
        </div>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
    </div>
  );
}

function StageFunnel({ engagements, onStageClick, activeFilter }) {
  return (
    <Card style={{ marginBottom: 20 }}>
      <CardHeader>
        <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>Pipeline by stage</span>
      </CardHeader>
      <div style={{ display: "flex" }}>
        {STAGES.map((s, i) => {
          const count = engagements.filter(e => e.currentStage === s.key).length;
          const isActive = activeFilter === s.key;
          return (
            <div key={s.key} onClick={() => onStageClick(isActive ? null : s.key)}
              style={{
                flex: 1, padding: "14px 8px", textAlign: "center", cursor: "pointer",
                background: isActive ? s.colour + "12" : "transparent",
                borderRight: i < STAGES.length - 1 ? "1px solid var(--border)" : "none",
                transition: "background 0.15s",
              }}
            >
              <div style={{ fontSize: 18, marginBottom: 4 }}>{s.icon}</div>
              <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 20, color: isActive ? s.colour : count > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                {count}
              </p>
              <p style={{ fontSize: 9, color: isActive ? s.colour : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
                {s.shortLabel}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function PipelinePage({ onSelectEngagement, onNewEngagement }) {
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState(null);
  const [ragFilter, setRagFilter] = useState(null);
  const { sortKey, sortDir, toggle, sort } = useSortable("updatedAt", "desc");

  function getSortValue(e, key) {
    switch (key) {
      case "customer":  return e.customer?.toLowerCase() || "";
      case "stage":     return STAGE_KEYS.indexOf(e.currentStage);
      case "tshirt":    return ["XS","S","Standard","L","XL"].indexOf(e.tshirt);
      case "region":    return e.region || "";
      case "arr":       return Number(e.arr) || 0;
      case "ragStatus": return ["green","amber","red"].indexOf(e.ragStatus);
      case "updatedAt": return e.updatedAt?.toMillis ? e.updatedAt.toMillis() : new Date(e.updatedAt||0).getTime();
      default:          return "";
    }
  }

  useEffect(() => {
    const q = query(collection(db, "engagements"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setEngagements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = engagements.filter(e => {
    if (stageFilter && e.currentStage !== stageFilter) return false;
    if (ragFilter && e.ragStatus !== ragFilter) return false;
    return true;
  });

  const totalArr = engagements.reduce((s, e) => s + (Number(e.arr) || 0), 0);
  const atRisk = engagements.filter(e => e.ragStatus === "amber" || e.ragStatus === "red").length;
  const inDelivery = engagements.filter(e => ["solution-delivery", "onboarding"].includes(e.currentStage)).length;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <Spinner size={28} />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Pipeline</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>All customer engagements across the lifecycle</p>
        </div>
        <Btn onClick={onNewEngagement}>+ New engagement</Btn>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="Total engagements" value={engagements.length} colour="var(--purple)" icon="📁" />
        <StatCard label="Pipeline ARR" value={totalArr > 0 ? `£${(totalArr / 1000).toFixed(0)}k` : "—"} colour="var(--green)" icon="💰" />
        <StatCard label="At risk / off track" value={atRisk} colour={atRisk > 0 ? "var(--amber)" : "var(--green)"} icon="⚠️" />
        <StatCard label="In delivery" value={inDelivery} colour="var(--blue)" icon="⚙️" />
      </div>

      {/* Stage funnel */}
      <StageFunnel engagements={engagements} onStageClick={setStageFilter} activeFilter={stageFilter} />

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[null, "amber", "red"].map(r => (
          <button key={r || "all"} onClick={() => setRagFilter(r)} style={{
            padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600,
            cursor: "pointer", border: "1px solid var(--border)", transition: "all 0.13s",
            background: ragFilter === r ? "var(--purple-light)" : "var(--surface)",
            color: ragFilter === r ? "var(--purple)" : "var(--text-second)",
          }}>
            {r === null ? "All" : r === "amber" ? "🟠 At risk" : "🔴 Off track"}
          </button>
        ))}
        {(stageFilter || ragFilter) && (
          <button onClick={() => { setStageFilter(null); setRagFilter(null); }} style={{
            padding: "4px 12px", borderRadius: 999, fontSize: 11, cursor: "pointer",
            border: "1px solid var(--red)", color: "var(--red)", background: "var(--red-light)",
          }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Engagement list */}
      <Card>
        {/* Headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 80px 80px 80px 70px 80px", gap: 10, padding: "9px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
          <SortableHeader label="Customer" sortKey="customer"  currentKey={sortKey} dir={sortDir} onToggle={toggle} />
          <SortableHeader label="Stage"    sortKey="stage"     currentKey={sortKey} dir={sortDir} onToggle={toggle} />
          <SortableHeader label="Size"     sortKey="tshirt"    currentKey={sortKey} dir={sortDir} onToggle={toggle} />
          <SortableHeader label="Region"   sortKey="region"    currentKey={sortKey} dir={sortDir} onToggle={toggle} />
          <SortableHeader label="ARR"      sortKey="arr"       currentKey={sortKey} dir={sortDir} onToggle={toggle} align="right" />
          <SortableHeader label="RAG"      sortKey="ragStatus" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
          <SortableHeader label="Updated"  sortKey="updatedAt" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon="📋" title="No engagements yet"
            description="Create your first engagement to start tracking the customer lifecycle"
            action={<Btn onClick={onNewEngagement}>+ New engagement</Btn>}
          />
        ) : (
          sort(filtered, getSortValue).map((e, i, arr) => {
            const stage = STAGES.find(s => s.key === e.currentStage);
            const rag = RAG_STATUSES.find(r => r.key === e.ragStatus) || RAG_STATUSES[0];
            const allTasks = STAGE_KEYS.flatMap(sk => e.stageTasks?.[sk] || []);
            const doneTasks = allTasks.filter(t => t.done).length;
            const pct = allTasks.length > 0 ? Math.round((doneTasks / allTasks.length) * 100) : 0;
            return (
              <div key={e.id} onClick={() => onSelectEngagement(e)} style={{
                display: "grid", gridTemplateColumns: "1fr 110px 80px 80px 80px 70px 80px",
                gap: 10, padding: "11px 18px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                cursor: "pointer", transition: "background 0.1s", alignItems: "center",
              }}
              onMouseEnter={e2 => e2.currentTarget.style.background = "var(--surface2)"}
              onMouseLeave={e2 => e2.currentTarget.style.background = "transparent"}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <p style={{ fontWeight: 500, fontSize: 13 }}>{e.customer}</p>
                    {e.planType && (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 3,
                        padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                        background: e.planType === "Enhancement" ? "rgba(101,89,255,0.12)" : "rgba(249,115,22,0.12)",
                        color: e.planType === "Enhancement" ? "var(--purple)" : "#ea6b0a",
                        flexShrink: 0,
                      }}>
                        {e.planType === "Enhancement" ? "⚡" : "🚀"} {e.planType}
                      </span>
                    )}
                  </div>
                  {e.csId && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.csId}</p>}
                  {allTasks.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <div style={{ flex: 1, maxWidth: 80, height: 3, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--green)" : "var(--purple)", borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{pct}%</span>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 13 }}>{stage?.icon}</span>
                  <span style={{ fontSize: 11, color: stage?.colour, fontWeight: 600 }}>{stage?.shortLabel}</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-second)" }}>{e.tshirt || "—"}</span>
                <span style={{ fontSize: 12, color: "var(--text-second)" }}>{e.region || "—"}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: e.arr ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {e.arr ? `£${Number(e.arr).toLocaleString()}` : "—"}
                </span>
                <Pill color={rag.key === "green" ? "green" : rag.key === "red" ? "red" : "amber"} style={{ fontSize: 10 }}>
                  {rag.emoji}
                </Pill>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {e.updatedAt ? timeAgo(e.updatedAt) : "—"}
                </span>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}

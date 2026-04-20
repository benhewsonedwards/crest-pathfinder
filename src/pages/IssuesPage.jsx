import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { STAGES, STAGE_KEYS, RAG_STATUSES, fmtDate } from "../lib/constants";
import { Card, CardHeader, Label, Pill, Avatar, Btn, Spinner, EmptyState, useSortable, SortableHeader } from "../components/UI";
import { PEOPLE } from "../lib/people";

function cseNameFromEmail(email) {
  if (!email) return "—";
  const p = PEOPLE.find(p => p.email === email);
  return p ? p.name.split(" ")[0] : email.split("@")[0];
}
function getIssueFlags(engagement) {
  const today = new Date();
  const updated = engagement.updatedAt?.toDate ? engagement.updatedAt.toDate() : new Date(engagement.updatedAt || 0);
  const daysSince = Math.floor((today - updated) / 86400000);
  const flags = [];
  if (engagement.ragStatus === "red")   flags.push({ label: "Off track", colour: "var(--red)" });
  if (engagement.ragStatus === "amber") flags.push({ label: "At risk",   colour: "var(--amber)" });
  if (daysSince >= 14 && !["go-live","csm-ongoing"].includes(engagement.currentStage))
    flags.push({ label: `No update ${daysSince}d`, colour: "#F97316" });
  if (engagement.currentStage === "opportunity" && daysSince >= 21)
    flags.push({ label: "Stalled opportunity", colour: "var(--slate)" });
  const allTasks = STAGE_KEYS.flatMap(sk => engagement.stageTasks?.[sk] || []);
  const overdue = allTasks.filter(t => !t.done && t.endDate && new Date(t.endDate) < today);
  if (overdue.length > 0) flags.push({ label: `${overdue.length} overdue task${overdue.length>1?"s":""}`, colour: "var(--red)" });
  return flags;
}

export default function IssuesPage({ onSelectEngagement }) {
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const { sortKey, sortDir, toggle, sort } = useSortable("updatedAt", "desc");

  function getIssueSortValue(e, key) {
    switch (key) {
      case "customer":  return e.customer?.toLowerCase() || "";
      case "stage":     return STAGE_KEYS.indexOf(e.currentStage);
      case "ragStatus": return ["green","amber","red"].indexOf(e.ragStatus);
      case "updatedAt": return e.updatedAt?.toMillis ? e.updatedAt.toMillis() : new Date(e.updatedAt||0).getTime();
      default:          return "";
    }
  }

  useEffect(() => {
    const q = query(collection(db, "engagements"), orderBy("updatedAt", "asc"));
    return onSnapshot(q, snap => {
      setEngagements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const flagged = engagements.filter(e => getIssueFlags(e).length > 0);

  const categories = [
    { key: "off-track",  label: "Off track",           colour: "var(--red)",    items: flagged.filter(e => e.ragStatus === "red") },
    { key: "at-risk",    label: "At risk",              colour: "var(--amber)",  items: flagged.filter(e => e.ragStatus === "amber") },
    { key: "stale",      label: "No update in 14+ days",colour: "#F97316",       items: flagged.filter(e => { const d = e.updatedAt?.toDate?e.updatedAt.toDate():new Date(e.updatedAt||0); return Math.floor((new Date()-d)/86400000)>=14 && !["go-live","csm-ongoing"].includes(e.currentStage); }) },
    { key: "overdue",    label: "Overdue tasks",        colour: "var(--red)",    items: flagged.filter(e => { const tasks = STAGE_KEYS.flatMap(sk=>e.stageTasks?.[sk]||[]); return tasks.some(t=>!t.done&&t.endDate&&new Date(t.endDate)<new Date()); }) },
  ].filter(c => c.items.length > 0);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <Spinner size={28} />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Issues</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {flagged.length} engagement{flagged.length !== 1 ? "s" : ""} flagged across {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
        </p>
      </div>

      {categories.length === 0 ? (
        <EmptyState icon="✅" title="No issues detected" description="All engagements are active and recently updated"/>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {categories.map(cat => (
            <Card key={cat.key} style={{ border: `1px solid ${cat.colour}30` }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10, padding: "12px 18px",
                background: cat.colour + "08", borderBottom: "1px solid var(--border)", cursor: "default",
              }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: cat.colour, flexShrink: 0 }}/>
                <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: cat.colour }}>{cat.label}</span>
                <span style={{ marginLeft: "auto", background: cat.colour + "20", color: cat.colour, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{cat.items.length}</span>
              </div>
              {/* Column headers */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 80px", gap: 10, padding: "7px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                <SortableHeader label="Customer"    sortKey="customer"  currentKey={sortKey} dir={sortDir} onToggle={toggle} />
                <SortableHeader label="Stage"       sortKey="stage"     currentKey={sortKey} dir={sortDir} onToggle={toggle} />
                <Label>CSE</Label>
                <SortableHeader label="RAG"         sortKey="ragStatus" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
                <SortableHeader label="Last update" sortKey="updatedAt" currentKey={sortKey} dir={sortDir} onToggle={toggle} />
              </div>
              {sort(cat.items, getIssueSortValue).map((e, i, arr) => {
                const stage = STAGES.find(s => s.key === e.currentStage);
                const rag = RAG_STATUSES.find(r => r.key === e.ragStatus) || RAG_STATUSES[0];
                const updated = e.updatedAt?.toDate ? e.updatedAt.toDate() : null;
                const daysSince = updated ? Math.floor((new Date()-updated)/86400000) : null;
                return (
                  <div key={e.id} onClick={() => onSelectEngagement(e)} style={{
                    display: "grid", gridTemplateColumns: "1fr 100px 80px 80px 80px",
                    gap: 10, padding: "10px 18px", borderBottom: i<arr.length-1?"1px solid var(--border)":"none",
                    cursor: "pointer", alignItems: "center",
                  }}
                  onMouseEnter={el => el.currentTarget.style.background = "var(--surface2)"}
                  onMouseLeave={el => el.currentTarget.style.background = "transparent"}
                  >
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 500 }}>{e.customer}</p>
                      {e.csId && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.csId}</p>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 12 }}>{stage?.icon}</span>
                      <span style={{ fontSize: 11, color: stage?.colour, fontWeight: 600 }}>{stage?.shortLabel}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{cseNameFromEmail(e.cseEmail)}</span>
                    <Pill color={rag.key==="green"?"green":rag.key==="red"?"red":"amber"} style={{ fontSize: 10 }}>{rag.emoji}</Pill>
                    <span style={{ fontSize: 11, color: daysSince >= 14 ? "var(--red)" : "var(--text-muted)", fontWeight: daysSince >= 14 ? 600 : 400 }}>
                      {daysSince !== null ? `${daysSince}d ago` : "—"}
                    </span>
                  </div>
                );
              })}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

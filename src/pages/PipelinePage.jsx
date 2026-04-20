import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { STAGES, STAGE_KEYS, RAG_STATUSES, fmtDate, timeAgo } from "../lib/constants";
import { Card, CardHeader, Label, Pill, Avatar, EmptyState, Btn, Spinner, Input, useSortable, SortableHeader } from "../components/UI";
import { PEOPLE } from "../lib/people";

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

export default function PipelinePage({ onSelectEngagement, onNewEngagement, personFilter, onClearPersonFilter, onSelectCustomer }) {
  const [engagements, setEngagements] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState(null);
  const [ragFilter, setRagFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("pipeline"); // "pipeline" | "renewals"
  const { sortKey, sortDir, toggle, sort } = useSortable("updatedAt", "desc");
  const { sortKey: rSortKey, sortDir: rSortDir, toggle: rToggle, sort: rSort } = useSortable("renewalDate", "asc");

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
    const unsub2 = onSnapshot(collection(db, "customers"), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub(); unsub2(); };
  }, []);

  const filtered = engagements.filter(e => {
    if (stageFilter && e.currentStage !== stageFilter) return false;
    if (ragFilter && e.ragStatus !== ragFilter) return false;
    if (personFilter && e.cseEmail !== personFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [e.customer, e.csId, e.region, e.cseEmail].some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const totalArr = engagements.reduce((s, e) => s + (Number(e.arr) || 0), 0);
  const atRisk = engagements.filter(e => e.ragStatus === "amber" || e.ragStatus === "red").length;
  const inDelivery = engagements.filter(e => ["solution-delivery", "onboarding"].includes(e.currentStage)).length;

  // Renewals — read from customers, bucket by quarter
  const today = new Date();
  const quarterEnd = (q) => {
    const m = today.getMonth();
    const qStart = Math.floor(m / 3) * 3 + q * 3;
    const yr = today.getFullYear() + Math.floor((m + q * 3) / 12);
    return new Date(yr, (qStart % 12) + 3, 0);
  };
  const q0End = quarterEnd(0), q1End = quarterEnd(1), q2End = quarterEnd(2);

  function renewalQuarter(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (d <= q0End) return 0;
    if (d <= q1End) return 1;
    if (d <= q2End) return 2;
    return 3;
  }

  const RENEWAL_STATUS_META = {
    on_track:       { emoji: "🟢", label: "On track",        colour: "var(--green)" },
    at_risk:        { emoji: "🟠", label: "At risk",         colour: "var(--amber)" },
    needs_attention:{ emoji: "🔴", label: "Needs attention", colour: "var(--red)"   },
    not_renewing:   { emoji: "⚫", label: "Not renewing",    colour: "var(--text-muted)" },
  };

  const renewalsWithDate = customers
    .filter(c => c.renewalDate)
    .map(c => ({ ...c, _quarter: renewalQuarter(c.renewalDate) }))
    .filter(c => c._quarter <= 2);

  const renewalsByQuarter = [0, 1, 2].map(q => ({
    q,
    label: q === 0 ? "This quarter" : q === 1 ? "Next quarter" : "Quarter +2",
    colour: q === 0 ? "var(--red)" : q === 1 ? "var(--amber)" : "var(--green)",
    items: renewalsWithDate.filter(c => c._quarter === q),
  }));

  const totalRenewalArr = renewalsWithDate.reduce((s, c) => s + (Number(c.renewalARR || c.arr) || 0), 0);
  const atRiskRenewals = renewalsWithDate.filter(c => c.renewalStatus === "at_risk" || c.renewalStatus === "needs_attention").length;

  function getRSortValue(c, key) {
    switch (key) {
      case "customer":      return c.name?.toLowerCase() || "";
      case "renewalDate":   return c.renewalDate || "";
      case "renewalARR":    return Number(c.renewalARR || c.arr) || 0;
      case "renewalStatus": return ["on_track","at_risk","needs_attention","not_renewing"].indexOf(c.renewalStatus || "on_track");
      default: return "";
    }
  }

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
          <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 2 }}>
            {view === "pipeline" ? "Pipeline" : "Renewals"}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {view === "pipeline" ? "All customer engagements across the lifecycle" : "Renewal forecast — next 3 quarters · manual entry until Salesforce sync"}
          </p>
        </div>
        <Btn onClick={onNewEngagement}>+ New engagement</Btn>
      </div>

      {/* View tabs */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
        {[["pipeline","📋 Pipeline"], ["renewals","🔄 Renewals"]].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)} style={{
            padding: "8px 18px", fontSize: 13, cursor: "pointer",
            border: "none", borderBottom: view === id ? "2px solid var(--purple)" : "2px solid transparent",
            background: "none", color: view === id ? "var(--purple)" : "var(--text-second)",
            fontWeight: view === id ? 600 : 400, fontFamily: "inherit", transition: "0.15s",
            marginBottom: -1,
          }}>
            {label}
            {id === "renewals" && renewalsWithDate.length > 0 && (
              <span style={{ marginLeft: 6, background: "var(--purple-light)", color: "var(--purple)", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>
                {renewalsWithDate.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ PIPELINE VIEW ══ */}
      {view === "pipeline" && (<>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard label="Total engagements" value={engagements.length} colour="var(--purple)" icon="📁" />
          <StatCard label="Pipeline ARR" value={totalArr > 0 ? `£${(totalArr / 1000).toFixed(0)}k` : "—"} colour="var(--green)" icon="💰" />
          <StatCard label="At risk / off track" value={atRisk} colour={atRisk > 0 ? "var(--amber)" : "var(--green)"} icon="⚠️" />
          <StatCard label="In delivery" value={inDelivery} colour="var(--blue)" icon="⚙️" />
        </div>

        {/* Person filter banner */}
        {personFilter && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
            padding: "10px 16px", borderRadius: "var(--radius)",
            background: "var(--purple-light)", border: "1px solid var(--purple)",
          }}>
            <span style={{ fontSize: 13, color: "var(--purple)", fontWeight: 600 }}>
              👤 Filtered by: {PEOPLE.find(p => p.email === personFilter)?.name || personFilter}
            </span>
            <button onClick={onClearPersonFilter} style={{
              marginLeft: "auto", fontSize: 11, padding: "3px 10px", borderRadius: 999,
              border: "1px solid var(--purple)", background: "transparent",
              color: "var(--purple)", cursor: "pointer", fontFamily: "inherit",
            }}>Clear</button>
          </div>
        )}

        {/* Stage funnel */}
        <StageFunnel engagements={engagements} onStageClick={setStageFilter} activeFilter={stageFilter} />

        {/* Filters + search */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 12 }}>🔍</span>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer, CS ID..." style={{ paddingLeft: 28, width: 220, fontSize: 12 }} />
          </div>
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
          {(stageFilter || ragFilter || search) && (
            <button onClick={() => { setStageFilter(null); setRagFilter(null); setSearch(""); }} style={{
              padding: "4px 12px", borderRadius: 999, fontSize: 11, cursor: "pointer",
              border: "1px solid var(--red)", color: "var(--red)", background: "var(--red-light)",
            }}>
              Clear filters
            </button>
          )}
        </div>

        {/* Engagement list */}
        <Card>
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
            engagements.length === 0 ? (
              <EmptyState
                icon="📋" title="No engagements yet"
                description="Create your first engagement to start tracking the customer lifecycle"
                action={<Btn onClick={onNewEngagement}>+ New engagement</Btn>}
              />
            ) : (
              <div style={{ padding: "28px 18px", textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>No engagements match your filters.</p>
                <button onClick={() => { setStageFilter(null); setRagFilter(null); setSearch(""); }} style={{
                  fontSize: 12, color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit"
                }}>Clear filters</button>
              </div>
            )
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
      </>)}

      {/* ══ RENEWALS VIEW ══ */}
      {view === "renewals" && (<>
        {/* Renewal stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard label="Tracked renewals" value={renewalsWithDate.length} colour="var(--purple)" icon="🔄" />
          <StatCard label="Renewal ARR (3Q)" value={totalRenewalArr > 0 ? `£${(totalRenewalArr / 1000).toFixed(0)}k` : "—"} colour="var(--green)" icon="💰" />
          <StatCard label="At risk / needs attn" value={atRiskRenewals} colour={atRiskRenewals > 0 ? "var(--amber)" : "var(--green)"} icon="⚠️" />
          <StatCard label="This quarter" value={renewalsByQuarter[0].items.length} colour="var(--red)" icon="📅" />
        </div>

        {renewalsWithDate.length === 0 ? (
          <Card style={{ padding: "40px 20px", textAlign: "center" }}>
            <p style={{ fontSize: 32, marginBottom: 10 }}>🔄</p>
            <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 15, color: "var(--text-primary)", marginBottom: 6 }}>No renewal dates set</p>
            <p style={{ fontSize: 13, color: "var(--text-muted)", maxWidth: 380, margin: "0 auto 16px" }}>
              Open any customer record and add a renewal date to start tracking your 3-quarter forecast.
            </p>
          </Card>
        ) : (
          renewalsByQuarter.map(({ q, label, colour, items }) => {
            if (items.length === 0) return (
              <div key={q} style={{ marginBottom: 10, border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: colour, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>{label} — no renewals</span>
              </div>
            );
            const qArr = items.reduce((s, e) => s + (Number(e.renewalARR || e.arr) || 0), 0);
            return (
              <div key={q} style={{ marginBottom: 14, border: `1px solid ${colour}44`, borderRadius: "var(--radius)", overflow: "hidden" }}>
                {/* Quarter header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", background: colour + "12" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: colour, flexShrink: 0 }} />
                  <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, color: colour }}>{label}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {items.length} renewal{items.length !== 1 ? "s" : ""}</span>
                  {qArr > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-second)", marginLeft: "auto" }}>£{qArr.toLocaleString()} ARR</span>}
                </div>
                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 110px 100px 90px", gap: 10, padding: "7px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                  <SortableHeader label="Customer"    sortKey="customer"      currentKey={rSortKey} dir={rSortDir} onToggle={rToggle} />
                  <SortableHeader label="Renewal date"sortKey="renewalDate"   currentKey={rSortKey} dir={rSortDir} onToggle={rToggle} />
                  <SortableHeader label="ARR"         sortKey="renewalARR"    currentKey={rSortKey} dir={rSortDir} onToggle={rToggle} />
                  <SortableHeader label="Status"      sortKey="renewalStatus" currentKey={rSortKey} dir={rSortDir} onToggle={rToggle} />
                  <Label style={{ textAlign: "right" }}>CSM</Label>
                </div>
                {/* Rows */}
                {rSort(items, getRSortValue).map((c, i, arr) => {
                  const statusMeta = RENEWAL_STATUS_META[c.renewalStatus || "on_track"];
                  const csmPerson = PEOPLE.find(p => p.email === c.csmEmail);
                  const csmName = csmPerson?.name?.split(" ")[0] || (c.csmEmail ? c.csmEmail.split("@")[0].split(".")[0] : "—");
                  const daysUntil = Math.ceil((new Date(c.renewalDate) - today) / 86400000);
                  return (
                    <div key={c.id} onClick={() => onSelectCustomer?.(c)} style={{
                      display: "grid", gridTemplateColumns: "1fr 120px 110px 100px 90px",
                      gap: 10, padding: "11px 18px", alignItems: "center",
                      borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                      cursor: onSelectCustomer ? "pointer" : "default", transition: "background 0.1s",
                    }}
                    onMouseEnter={e => { if (onSelectCustomer) e.currentTarget.style.background = "var(--surface2)"; }}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      <div>
                        <p style={{ fontWeight: 500, fontSize: 13 }}>{c.name}</p>
                        {c.sfAccountId && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{c.sfAccountId}</p>}
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: daysUntil <= 30 ? colour : "var(--text-primary)" }}>
                          {new Date(c.renewalDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {daysUntil <= 0 ? "Overdue" : `${daysUntil}d away`}
                        </p>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
                        {(c.renewalARR || c.arr) ? `£${Number(c.renewalARR || c.arr).toLocaleString()}` : "—"}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: statusMeta.colour }}>
                        {statusMeta.emoji} {statusMeta.label}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>{csmName}</span>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
        <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
          ☁️ Salesforce sync coming — renewal dates are entered on the customer record. Edit any customer to update.
        </p>
      </>)}
    </div>
  );
}

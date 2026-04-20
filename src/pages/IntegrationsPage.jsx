import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { INTEGRATION_CATEGORIES, INTEGRATION_STATUSES, integrationStatus } from "../lib/integrationConstants";
import { Card, CardHeader, Label, Pill, Btn, Input, Spinner, EmptyState } from "../components/UI";

// ─── Colour map for category chips ───────────────────────────────────────────
const CAT_COLOURS = {
  "SSO":                      { colour: "#8B5CF6", bg: "#EDE9FE" },
  "User Provisioning / SCIM": { colour: "#6559FF", bg: "#EEF2FF" },
  "Data Sync":                { colour: "#0EA5E9", bg: "#E0F2FE" },
  "Process Automation":       { colour: "#F97316", bg: "#FFEDD5" },
  "Reporting / BI":           { colour: "#D97706", bg: "#FEF3C7" },
  "Notifications":            { colour: "#06B6D4", bg: "#CFFAFE" },
  "File Transfer":            { colour: "#64748B", bg: "#F1F5F9" },
  "ERP Integration":          { colour: "#DC2626", bg: "#FEE2E2" },
  "HRIS Integration":         { colour: "#16A34A", bg: "#DCFCE7" },
  "Custom API":               { colour: "#7C3AED", bg: "#F5F3FF" },
  "Other":                    { colour: "#94A3B8", bg: "#F8FAFC" },
};

function catColour(cat) {
  return CAT_COLOURS[cat] || { colour: "#64748B", bg: "#F1F5F9" };
}

function StatusDot({ statusKey }) {
  const s = integrationStatus(statusKey);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
      color: s.colour, background: s.bg, borderRadius: 999, padding: "2px 8px" }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.colour, flexShrink: 0 }} />
      {s.label}
    </span>
  );
}

// ─── Single integration card row ─────────────────────────────────────────────
function IntegrationRow({ integration, engagement, onSelectCustomer, onSelectEngagement, isLast }) {
  const [expanded, setExpanded] = useState(false);
  const cc = catColour(integration.category);

  // Collect all task files from the linked engagement (solution design, handover docs, etc.)
  const taskDocs = [];
  if (engagement?.stageTasks) {
    Object.entries(engagement.stageTasks).forEach(([stageKey, tasks]) => {
      (tasks || []).forEach(t => {
        (t.files || []).forEach(f => {
          taskDocs.push({ ...f, taskTitle: t.title, stageKey });
        });
      });
    });
  }

  return (
    <div style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>
      {/* Main row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr) 160px 140px 120px 28px",
          gap: 12, padding: "11px 18px", alignItems: "center",
          cursor: "pointer", transition: "background 0.1s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--purple-light)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        {/* Name + systems */}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{integration.name}</p>
          {(integration.sourceSystem || integration.targetSystem) && (
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {[integration.sourceSystem, integration.targetSystem].filter(Boolean).join(" → ")}
            </p>
          )}
        </div>

        {/* Customer */}
        <div
          onClick={e => { e.stopPropagation(); onSelectCustomer?.(integration); }}
          style={{ minWidth: 0, cursor: onSelectCustomer ? "pointer" : "default" }}
          title={onSelectCustomer ? `Open ${integration.customerName}` : undefined}
        >
          <p style={{
            fontSize: 12, fontWeight: 500,
            color: onSelectCustomer ? "var(--purple)" : "var(--text-second)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {integration.customerName || "—"}
          </p>
          {onSelectCustomer && (
            <p style={{ fontSize: 10, color: "var(--text-muted)" }}>Open customer →</p>
          )}
        </div>

        {/* Status */}
        <StatusDot statusKey={integration.status} />

        {/* Middleware */}
        <span style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {integration.middleware || "—"}
        </span>

        {/* Expand toggle */}
        <span style={{ fontSize: 14, color: "var(--text-muted)", transform: expanded ? "rotate(180deg)" : "none", transition: ".2s", textAlign: "center" }}>⌄</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          margin: "0 18px 12px",
          background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "14px 16px",
        }}>
          {/* Engagement link */}
          {engagement && (
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>Linked engagement</p>
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                  {engagement.customer || engagement.csId || "Unnamed engagement"}
                  {engagement.csId && engagement.customer && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{engagement.csId}</span>}
                </p>
              </div>
              {onSelectEngagement && (
                <button
                  onClick={e => { e.stopPropagation(); onSelectEngagement(engagement); }}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: "5px 12px",
                    borderRadius: "var(--radius-sm)", border: "1px solid var(--purple)",
                    background: "var(--purple-light)", color: "var(--purple)",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Open engagement →
                </button>
              )}
            </div>
          )}

          {integration.problemStatement && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 5 }}>Problem statement</p>
              <p style={{ fontSize: 13, color: "var(--text-second)", lineHeight: 1.6 }}>{integration.problemStatement}</p>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {[
              ["Category", integration.category],
              ["Data direction", integration.dataDirection],
              ["Trigger type", integration.triggerType],
              ["Business impact", integration.businessImpact],
              ["Workato env", integration.workatoEnv],
              ["Feasibility", integration.feasibility],
            ].filter(([, v]) => v).map(([label, value]) => (
              <div key={label}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>{label}</p>
                <p style={{ fontSize: 12, color: "var(--text-second)" }}>{value}</p>
              </div>
            ))}
          </div>

          {integration.businessImpactExplanation && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Impact detail</p>
              <p style={{ fontSize: 12, color: "var(--text-second)", lineHeight: 1.5 }}>{integration.businessImpactExplanation}</p>
            </div>
          )}

          {/* Jira tickets */}
          {(integration.tickets || []).filter(t => t.jiraKey).length > 0 && (
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(integration.tickets || []).filter(t => t.jiraKey).map((t, i) => (
                <a key={i} href={`https://safetyculture.atlassian.net/browse/${t.jiraKey}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 11, color: "var(--purple)", fontWeight: 600, padding: "2px 8px", background: "var(--purple-light)", borderRadius: 999, textDecoration: "none" }}
                  onClick={e => e.stopPropagation()}>
                  {t.jiraKey} →
                </a>
              ))}
            </div>
          )}

          {/* Task documents from the linked engagement */}
          {taskDocs.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                Documents ({taskDocs.length})
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {taskDocs.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ fontSize: 14 }}>📎</span>
                    <a href={f.url} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ color: "var(--purple)", fontWeight: 500, textDecoration: "none" }}>
                      {f.name}
                    </a>
                    <span style={{ color: "var(--text-muted)", fontSize: 11 }}>— {f.taskTitle}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Category group card ──────────────────────────────────────────────────────
function CategoryGroup({ category, integrations, engagements, onSelectCustomer, onSelectEngagement }) {
  const [open, setOpen] = useState(true);
  const cc = catColour(category);
  const liveCount = integrations.filter(i => i.status === "live" || i.status === "live-attention").length;

  return (
    <Card style={{ marginBottom: 12 }}>
      <CardHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }} onClick={() => setOpen(o => !o)}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: cc.colour, flexShrink: 0 }} />
          <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, color: cc.colour }}>
            {category}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)",
            background: "var(--surface2)", borderRadius: 999, padding: "2px 8px" }}>
            {integrations.length} integration{integrations.length !== 1 ? "s" : ""}
          </span>
          {liveCount > 0 && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#16A34A",
              background: "#DCFCE7", borderRadius: 999, padding: "2px 8px" }}>
              {liveCount} live
            </span>
          )}
        </div>
        <span style={{ fontSize: 14, color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none", transition: ".2s" }}>⌄</span>
      </CardHeader>

      {open && (
        <div>
          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px 140px 120px 28px",
            gap: 12, padding: "6px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
            <Label>Integration</Label>
            <Label>Customer</Label>
            <Label>Status</Label>
            <Label>Middleware</Label>
            <span />
          </div>

          {integrations
            .sort((a, b) => {
              // Live first, then alphabetical by customer
              const statusOrder = { live: 0, "live-attention": 1, testing: 2, "in-build": 3, scoping: 4, broken: 5, decommissioned: 6 };
              const sa = statusOrder[a.status] ?? 9;
              const sb = statusOrder[b.status] ?? 9;
              if (sa !== sb) return sa - sb;
              return (a.customerName || "").localeCompare(b.customerName || "");
            })
            .map((integration, i, arr) => (
              <IntegrationRow
                key={integration.id}
                integration={integration}
                engagement={engagements.find(e =>
                  e.id === integration.engagementId ||
                  (integration.customerId && e.customerId === integration.customerId)
                )}
                onSelectCustomer={onSelectCustomer}
                onSelectEngagement={onSelectEngagement}
                isLast={i === arr.length - 1}
              />
            ))}
        </div>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function IntegrationsPage({ onSelectCustomer, onSelectEngagement }) {
  const [integrations, setIntegrations] = useState([]);
  const [engagements, setEngagements]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatus]       = useState("");

  useEffect(() => {
    let intDone = false, engDone = false;
    const checkDone = () => { if (intDone && engDone) setLoading(false); };
    const unsub1 = onSnapshot(collection(db, "integrations"), snap => {
      setIntegrations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      intDone = true; checkDone();
    });
    const unsub2 = onSnapshot(collection(db, "engagements"), snap => {
      setEngagements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      engDone = true; checkDone();
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Filter
  const filtered = integrations.filter(i => {
    if (statusFilter && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return [i.name, i.customerName, i.sourceSystem, i.targetSystem, i.category, i.middleware]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  // Group by category — show all categories that have integrations, sorted by count desc
  const grouped = {};
  filtered.forEach(i => {
    const cat = i.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(i);
  });
  const sortedCategories = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length);

  // Stats
  const liveCount      = integrations.filter(i => i.status === "live" || i.status === "live-attention").length;
  const inBuildCount   = integrations.filter(i => i.status === "in-build" || i.status === "testing" || i.status === "scoping").length;
  const uniqueCustomers = new Set(integrations.map(i => i.customerId).filter(Boolean)).size;

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <Spinner size={28} />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>
          Integrations
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {integrations.length} integrations across {uniqueCustomers} customer{uniqueCustomers !== 1 ? "s" : ""} &nbsp;·&nbsp;
          <span style={{ color: "#16A34A" }}>{liveCount} live</span>
          {inBuildCount > 0 && <span> &nbsp;·&nbsp; {inBuildCount} in progress</span>}
        </p>
      </div>

      {/* Stat chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        {sortedCategories.map(cat => {
          const cc = catColour(cat);
          return (
            <button
              key={cat}
              onClick={() => setSearch(search === cat ? "" : cat)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                background: search === cat ? cc.colour : cc.bg,
                color: search === cat ? "white" : cc.colour,
                border: `1px solid ${cc.colour}40`,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {cat}
              <span style={{
                background: search === cat ? "rgba(255,255,255,0.3)" : cc.colour + "20",
                borderRadius: 999, padding: "0 5px", fontSize: 11,
              }}>
                {grouped[cat]?.length || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + filter bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, customer, system, category..."
          style={{ flex: 1, maxWidth: 440 }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontFamily: "inherit", fontSize: 13, background: "var(--surface)", color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
        >
          <option value="">All statuses</option>
          {INTEGRATION_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        {(search || statusFilter) && (
          <Btn variant="ghost" size="sm" onClick={() => { setSearch(""); setStatus(""); }}>Clear</Btn>
        )}
      </div>

      {/* Results */}
      {integrations.length === 0 ? (
        <EmptyState
          icon="🔌"
          title="No integrations yet"
          description="Integrations are added from the customer view. Once created, they'll appear here grouped by type."
        />
      ) : sortedCategories.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: 13 }}>
          No integrations match your search.
          <button onClick={() => { setSearch(""); setStatus(""); }}
            style={{ marginLeft: 8, color: "var(--purple)", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>
            Clear filters
          </button>
        </div>
      ) : (
        sortedCategories.map(cat => (
          <CategoryGroup
            key={cat}
            category={cat}
            integrations={grouped[cat]}
            engagements={engagements}
            onSelectCustomer={onSelectCustomer}
            onSelectEngagement={onSelectEngagement}
          />
        ))
      )}
    </div>
  );
}

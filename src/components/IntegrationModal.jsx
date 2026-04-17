import { useState, useEffect } from "react";
import {
  collection, doc, addDoc, updateDoc, onSnapshot,
  serverTimestamp, query, where, orderBy
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { exportIntegrationSpec } from "../lib/exportIntegration";
import {
  INTEGRATION_STATUSES, INTEGRATION_CATEGORIES,
  TICKET_TYPES, WORKATO_ENVS, DATA_DIRECTIONS,
  TRIGGER_TYPES, FEASIBILITY, BUSINESS_IMPACT,
  integrationStatus, ticketType
} from "../lib/integrationConstants";
import {
  Card, CardHeader, Label, Pill, Btn, Tabs,
  Input, Select, Textarea, Modal, FieldGroup, Spinner
} from "../components/UI";

// ─── Version history entry ────────────────────────────────────────────────────
function VersionRow({ entry, onDelete, canEdit }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "110px 60px 1fr auto",
      gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--border)",
      alignItems: "start", fontSize: 13,
    }}>
      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{entry.date}</span>
      <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, color: "var(--purple)", fontSize: 12 }}>{entry.version}</span>
      <span style={{ color: "var(--text-second)", lineHeight: 1.5 }}>{entry.description}</span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{entry.author}</span>
        {canEdit && onDelete && (
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: "0 4px" }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--red)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>✕</button>
        )}
      </div>
    </div>
  );
}

// ─── Ticket row ───────────────────────────────────────────────────────────────
function TicketRow({ ticket, onUpdate, onDelete, canEdit }) {
  const tt = ticketType(ticket.type);
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "120px 120px 1fr 110px auto",
      gap: 10, padding: "10px 16px", borderBottom: "1px solid var(--border)",
      alignItems: "center",
    }}>
      <Select value={ticket.type} onChange={e => canEdit && onUpdate({ type: e.target.value })} style={{ fontSize: 11, padding: "4px 8px" }}>
        {TICKET_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
      </Select>
      <Input value={ticket.jiraKey || ""} onChange={e => canEdit && onUpdate({ jiraKey: e.target.value })}
        placeholder="CSE-1234" style={{ fontSize: 12, padding: "4px 8px" }} />
      <Input value={ticket.description || ""} onChange={e => canEdit && onUpdate({ description: e.target.value })}
        placeholder="Brief description" style={{ fontSize: 12, padding: "4px 8px" }} />
      <Select value={ticket.status || "open"} onChange={e => canEdit && onUpdate({ status: e.target.value })} style={{ fontSize: 11, padding: "4px 8px" }}>
        <option value="open">Open</option>
        <option value="in-progress">In Progress</option>
        <option value="done">Done</option>
        <option value="on-hold">On Hold</option>
      </Select>
      {canEdit && (
        <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 13 }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--red)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}>✕</button>
      )}
    </div>
  );
}

// ─── Main integration modal / form ───────────────────────────────────────────
export default function IntegrationModal({ open, onClose, customerId, customerName, initial, users }) {
  const { user, profile } = useAuth();
  const isEdit = !!initial?.id;
  const canEdit = ["super_admin", "admin", "cse"].includes(profile?.role);

  const BLANK = {
    name: "", category: "Data Sync", status: "scoping",
    customerId, customerName,
    cseBuiltBy: user?.displayName || "",
    engagementId: "", engagementName: "",
    // Scoping
    problemStatement: "", businessImpact: "Medium", businessImpactExplanation: "",
    desiredOutcome: "", roi: "", risks: "",
    mustHave: "", shouldHave: "", couldHave: "", cantHave: "",
    nfRequirements: "", assumptions: "",
    sourceSystem: "", targetSystem: "", middleware: "",
    dataDirection: "One-way (External → SC)",
    triggerType: "Event-driven (Webhook)", sensitiveData: "",
    runFrequency: "", feasibility: "green",
    scopingHours: "", devHours: "", testingHours: "", uatHours: "",
    proposedGoLiveDate: "",
    // Design
    highLevelArchitecture: "", triggerEvent: "",
    dataTransformation: "", sourceApiCalls: "", destinationApiCalls: "",
    integrationSteps: "", successCriteria: "", fieldMapping: "",
    loggingMechanism: "Workato logs", retryLogic: "", failureNotification: "",
    // Operational
    workatoEnv: "EU", workatoRecipeUrl: "", workatoRecipeFolder: "",
    scOrgRoleId: "", accountRoleId: "",
    knownChallenges: "", operationalNotes: "",
    // Tickets & versions
    tickets: [{ type: "initial", jiraKey: "", description: "Initial CSR", status: "open" }],
    versionHistory: [{ date: new Date().toISOString().slice(0, 10), version: "1.0", description: "Initial design", author: user?.displayName || "" }],
  };

  const [form, setForm] = useState(initial ? { ...BLANK, ...initial } : BLANK);
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [newVersion, setNewVersion] = useState({ date: new Date().toISOString().slice(0,10), version: "", description: "", author: user?.displayName || "" });
  const [addingVersion, setAddingVersion] = useState(false);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function updateTicket(idx, updates) {
    const tickets = [...(form.tickets || [])];
    tickets[idx] = { ...tickets[idx], ...updates };
    upd("tickets", tickets);
  }
  function deleteTicket(idx) { upd("tickets", (form.tickets || []).filter((_, i) => i !== idx)); }
  function addTicket() { upd("tickets", [...(form.tickets || []), { type: "bug-fix", jiraKey: "", description: "", status: "open" }]); }

  function deleteVersion(idx) { upd("versionHistory", (form.versionHistory || []).filter((_, i) => i !== idx)); }
  function addVersion() {
    if (!newVersion.version || !newVersion.description) return;
    upd("versionHistory", [...(form.versionHistory || []), { ...newVersion }]);
    setNewVersion({ date: new Date().toISOString().slice(0,10), version: "", description: "", author: user?.displayName || "" });
    setAddingVersion(false);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    const data = { ...form, customerId, customerName, updatedAt: serverTimestamp() };
    if (isEdit) {
      await updateDoc(doc(db, "integrations", initial.id), data);
    } else {
      await addDoc(collection(db, "integrations"), { ...data, createdAt: serverTimestamp(), createdBy: user?.uid });
    }
    setSaving(false);
    onClose();
  }

  const st = integrationStatus(form.status);
  const totalHours = (Number(form.scopingHours)||0) + (Number(form.devHours)||0) + (Number(form.testingHours)||0) + (Number(form.uatHours)||0);

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "scoping", label: "Scoping" },
    { id: "design", label: "Design" },
    { id: "operational", label: "Operational" },
    { id: "tickets", label: "Tickets", badge: (form.tickets||[]).filter(t=>t.status!=="done").length || null },
    { id: "versions", label: "Version History", badge: (form.versionHistory||[]).length || null },
  ];

  return (
    <Modal open={open} onClose={onClose}
      title={isEdit ? `${form.name}` : "New integration"}
      width={740}>
      {/* Status bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 0 16px", marginBottom: 4,
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Customer:</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{customerName}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "3px 10px", borderRadius: 999,
            background: st.bg, color: st.colour, fontSize: 11, fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.colour }} />
            {st.label}
          </span>
        </span>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} style={{ marginBottom: 18 }} />

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Integration name" required>
              <Input value={form.name} onChange={e => upd("name", e.target.value)} placeholder="e.g. Workvivo → SC User Provisioning" />
            </FieldGroup>
          </div>
          <FieldGroup label="Category">
            <Select value={form.category} onChange={e => upd("category", e.target.value)}>
              {INTEGRATION_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Status">
            <Select value={form.status} onChange={e => upd("status", e.target.value)}>
              {INTEGRATION_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Built by (CSE)">
            <Input value={form.cseBuiltBy} onChange={e => upd("cseBuiltBy", e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Proposed go-live date">
            <Input type="date" value={form.proposedGoLiveDate} onChange={e => upd("proposedGoLiveDate", e.target.value)} />
          </FieldGroup>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Problem statement / use case">
              <Textarea value={form.problemStatement} onChange={e => upd("problemStatement", e.target.value)} placeholder="What problem does this integration solve?" rows={3} />
            </FieldGroup>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Desired outcome">
              <Textarea value={form.desiredOutcome} onChange={e => upd("desiredOutcome", e.target.value)} placeholder="e.g. Reduce manual admin by 5 hours/week" rows={2} />
            </FieldGroup>
          </div>
          <FieldGroup label="Source system">
            <Input value={form.sourceSystem} onChange={e => upd("sourceSystem", e.target.value)} placeholder="e.g. Workvivo, SAP, Dayforce" />
          </FieldGroup>
          <FieldGroup label="Target system">
            <Input value={form.targetSystem} onChange={e => upd("targetSystem", e.target.value)} placeholder="e.g. SafetyCulture" />
          </FieldGroup>
          <FieldGroup label="Data direction">
            <Select value={form.dataDirection} onChange={e => upd("dataDirection", e.target.value)}>
              {DATA_DIRECTIONS.map(d => <option key={d}>{d}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Trigger type">
            <Select value={form.triggerType} onChange={e => upd("triggerType", e.target.value)}>
              {TRIGGER_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </FieldGroup>
        </div>
      )}

      {/* ── SCOPING ── */}
      {tab === "scoping" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldGroup label="Business impact">
            <Select value={form.businessImpact} onChange={e => upd("businessImpact", e.target.value)}>
              {BUSINESS_IMPACT.map(b => <option key={b}>{b}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Feasibility">
            <Select value={form.feasibility} onChange={e => upd("feasibility", e.target.value)}>
              {FEASIBILITY.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
            </Select>
          </FieldGroup>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Business impact explanation">
              <Textarea value={form.businessImpactExplanation} onChange={e => upd("businessImpactExplanation", e.target.value)} rows={2} />
            </FieldGroup>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="ROI / value"><Textarea value={form.roi} onChange={e => upd("roi", e.target.value)} rows={2} /></FieldGroup>
          </div>
          <FieldGroup label="Must have"><Textarea value={form.mustHave} onChange={e => upd("mustHave", e.target.value)} rows={3} /></FieldGroup>
          <FieldGroup label="Should have"><Textarea value={form.shouldHave} onChange={e => upd("shouldHave", e.target.value)} rows={3} /></FieldGroup>
          <FieldGroup label="Could have"><Textarea value={form.couldHave} onChange={e => upd("couldHave", e.target.value)} rows={2} /></FieldGroup>
          <FieldGroup label="Can't have / out of scope"><Textarea value={form.cantHave} onChange={e => upd("cantHave", e.target.value)} rows={2} /></FieldGroup>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Non-functional requirements"><Textarea value={form.nfRequirements} onChange={e => upd("nfRequirements", e.target.value)} rows={2} /></FieldGroup>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Assumptions"><Textarea value={form.assumptions} onChange={e => upd("assumptions", e.target.value)} rows={2} /></FieldGroup>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Risks"><Textarea value={form.risks} onChange={e => upd("risks", e.target.value)} rows={2} /></FieldGroup>
          </div>
          {/* Effort table */}
          <div style={{ gridColumn: "1 / -1" }}>
            <Label style={{ display: "block", marginBottom: 8 }}>Effort estimate (hours)</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {[["Scoping", "scopingHours"], ["Development", "devHours"], ["Testing", "testingHours"], ["UAT", "uatHours"]].map(([label, key]) => (
                <div key={key}>
                  <Label style={{ marginBottom: 4, display: "block" }}>{label}</Label>
                  <Input value={form[key]} onChange={e => upd(key, e.target.value)} type="number" style={{ fontSize: 12 }} />
                </div>
              ))}
              <div>
                <Label style={{ marginBottom: 4, display: "block" }}>Total</Label>
                <div style={{ padding: "8px 12px", background: "var(--purple-light)", color: "var(--purple)", borderRadius: "var(--radius-sm)", fontSize: 13, fontWeight: 700 }}>{totalHours}h</div>
              </div>
            </div>
          </div>
          <FieldGroup label="Run frequency">
            <Input value={form.runFrequency} onChange={e => upd("runFrequency", e.target.value)} placeholder="e.g. Daily at 3am, Real-time" />
          </FieldGroup>
          <FieldGroup label="Sensitive data">
            <Input value={form.sensitiveData} onChange={e => upd("sensitiveData", e.target.value)} placeholder="e.g. HR data, Financial records" />
          </FieldGroup>
        </div>
      )}

      {/* ── DESIGN ── */}
      {tab === "design" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="High-level architecture">
              <Textarea value={form.highLevelArchitecture} onChange={e => upd("highLevelArchitecture", e.target.value)} placeholder="Describe the architecture and component flow..." rows={4} />
            </FieldGroup>
          </div>
          <FieldGroup label="Trigger event">
            <Textarea value={form.triggerEvent} onChange={e => upd("triggerEvent", e.target.value)} rows={2} placeholder="What triggers this integration?" />
          </FieldGroup>
          <FieldGroup label="Data transformation">
            <Textarea value={form.dataTransformation} onChange={e => upd("dataTransformation", e.target.value)} rows={2} placeholder="Field mappings, transformations..." />
          </FieldGroup>
          <FieldGroup label="Source API calls">
            <Textarea value={form.sourceApiCalls} onChange={e => upd("sourceApiCalls", e.target.value)} rows={3} placeholder="https://api.vendor.com/v1/..." />
          </FieldGroup>
          <FieldGroup label="Destination API calls">
            <Textarea value={form.destinationApiCalls} onChange={e => upd("destinationApiCalls", e.target.value)} rows={3} placeholder="https://developer.safetyculture.com/..." />
          </FieldGroup>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Integration steps (1. Trigger → 2. Lookup → 3. Transform → 4. Post)">
              <Textarea value={form.integrationSteps} onChange={e => upd("integrationSteps", e.target.value)} rows={4} />
            </FieldGroup>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Field mapping (source → destination)">
              <Textarea value={form.fieldMapping} onChange={e => upd("fieldMapping", e.target.value)} rows={4} placeholder="source_field → destination_field (notes)" />
            </FieldGroup>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Success criteria">
              <Textarea value={form.successCriteria} onChange={e => upd("successCriteria", e.target.value)} rows={2} placeholder="e.g. Record created in SC with matching ID; logged with timestamp" />
            </FieldGroup>
          </div>
          <FieldGroup label="Logging mechanism">
            <Input value={form.loggingMechanism} onChange={e => upd("loggingMechanism", e.target.value)} />
          </FieldGroup>
          <FieldGroup label="Retry logic">
            <Input value={form.retryLogic} onChange={e => upd("retryLogic", e.target.value)} placeholder="e.g. 3 retries with exponential backoff" />
          </FieldGroup>
          <FieldGroup label="Failure notification method">
            <Input value={form.failureNotification} onChange={e => upd("failureNotification", e.target.value)} placeholder="e.g. Email, Workato logs, SC Action" />
          </FieldGroup>
        </div>
      )}

      {/* ── OPERATIONAL ── */}
      {tab === "operational" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldGroup label="Workato environment">
            <Select value={form.workatoEnv} onChange={e => upd("workatoEnv", e.target.value)}>
              {WORKATO_ENVS.map(e => <option key={e}>{e}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Recipe URL">
            <Input value={form.workatoRecipeUrl} onChange={e => upd("workatoRecipeUrl", e.target.value)} placeholder="https://app.eu.workato.com/recipes/..." />
          </FieldGroup>
          <FieldGroup label="Recipe folder / ID">
            <Input value={form.workatoRecipeFolder} onChange={e => upd("workatoRecipeFolder", e.target.value)} placeholder="Folder ID or path" />
          </FieldGroup>
          <FieldGroup label="SC Account Role ID">
            <Input value={form.scOrgRoleId || form.accountRoleId} onChange={e => upd("scOrgRoleId", e.target.value)} placeholder="role_..." />
          </FieldGroup>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Known challenges / limitations">
              <Textarea value={form.knownChallenges} onChange={e => upd("knownChallenges", e.target.value)} rows={3} placeholder="e.g. Vendor API has no native active/inactive flag — deactivation relies on LeaveDate being populated" />
            </FieldGroup>
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Operational notes">
              <Textarea value={form.operationalNotes} onChange={e => upd("operationalNotes", e.target.value)} rows={3} placeholder="Post-go-live monitoring notes, maintenance schedule, known issues..." />
            </FieldGroup>
          </div>
          {/* Middleware */}
          <FieldGroup label="Middleware">
            <Input value={form.middleware} onChange={e => upd("middleware", e.target.value)} placeholder="e.g. Workato, Power Automate, None" />
          </FieldGroup>
        </div>
      )}

      {/* ── TICKETS ── */}
      {tab === "tickets" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Track the initial CSR and all follow-on tickets (bug fixes, enhancements, config changes)</p>
            {canEdit && <Btn size="sm" variant="ghost" onClick={addTicket}>+ Add ticket</Btn>}
          </div>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "120px 120px 1fr 110px auto", gap: 10, padding: "7px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
              {["Type", "Jira key", "Description", "Status", ""].map(h => <Label key={h}>{h}</Label>)}
            </div>
            {(form.tickets || []).length === 0 ? (
              <p style={{ padding: "16px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No tickets yet</p>
            ) : (form.tickets || []).map((ticket, i) => (
              <TicketRow key={i} ticket={ticket}
                onUpdate={u => canEdit && updateTicket(i, u)}
                onDelete={() => canEdit && deleteTicket(i)}
                canEdit={canEdit} />
            ))}
          </Card>

          {/* Ticket summary */}
          {(form.tickets || []).length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {TICKET_TYPES.map(tt => {
                const count = (form.tickets || []).filter(t => t.type === tt.key).length;
                if (!count) return null;
                return (
                  <span key={tt.key} style={{
                    padding: "2px 10px", borderRadius: 999, fontSize: 11,
                    background: tt.colour + "15", color: tt.colour, fontWeight: 600,
                  }}>{tt.label}: {count}</span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── VERSION HISTORY ── */}
      {tab === "versions" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Full change log for this integration</p>
            {canEdit && <Btn size="sm" variant="ghost" onClick={() => setAddingVersion(true)}>+ Add version</Btn>}
          </div>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "110px 60px 1fr auto", gap: 12, padding: "7px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
              {["Date", "Version", "Description / Changes", "Author"].map(h => <Label key={h}>{h}</Label>)}
            </div>
            {(form.versionHistory || []).length === 0 ? (
              <p style={{ padding: "16px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No versions logged yet</p>
            ) : [...(form.versionHistory || [])].reverse().map((entry, i) => (
              <VersionRow key={i} entry={entry}
                onDelete={() => canEdit && deleteVersion(form.versionHistory.length - 1 - i)}
                canEdit={canEdit} />
            ))}
          </Card>

          {addingVersion && (
            <div style={{ marginTop: 12, padding: 14, background: "var(--surface2)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Add version entry</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FieldGroup label="Date"><Input type="date" value={newVersion.date} onChange={e => setNewVersion(v => ({ ...v, date: e.target.value }))} /></FieldGroup>
                <FieldGroup label="Version"><Input value={newVersion.version} onChange={e => setNewVersion(v => ({ ...v, version: e.target.value }))} placeholder="e.g. 1.1" /></FieldGroup>
                <div style={{ gridColumn: "1 / -1" }}>
                  <FieldGroup label="Description">
                    <Textarea value={newVersion.description} onChange={e => setNewVersion(v => ({ ...v, description: e.target.value }))} rows={2} placeholder="What changed?" />
                  </FieldGroup>
                </div>
                <FieldGroup label="Author"><Input value={newVersion.author} onChange={e => setNewVersion(v => ({ ...v, author: e.target.value }))} /></FieldGroup>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <Btn variant="ghost" size="sm" onClick={() => setAddingVersion(false)}>Cancel</Btn>
                <Btn size="sm" onClick={addVersion} disabled={!newVersion.version || !newVersion.description}>Add entry</Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 22, borderTop: "1px solid var(--border)", paddingTop: 18 }}>
        {/* Export button — left side, only for existing records */}
        <div>
          {isEdit && (
            <Btn
              variant="ghost"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try { await exportIntegrationSpec(form); } finally { setExporting(false); }
              }}
            >
              {exporting ? "Generating..." : "⬇ Export spec (.docx)"}
            </Btn>
          )}
        </div>
        {/* Save / Cancel — right side */}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          {canEdit && (
            <Btn onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? "Saving..." : isEdit ? "Save changes" : "Create integration"}
            </Btn>
          )}
        </div>
      </div>
    </Modal>
  );
}

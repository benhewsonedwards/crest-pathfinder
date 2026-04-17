import { useState } from "react";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { STAGES, REGIONS, SEGMENTS, SUBSCRIPTIONS, OPP_TYPES, TSHIRT_SIZES, CURRENCIES, PLAN_TYPES, RAG_STATUSES, SC_MODULES, INTEGRATIONS, buildDefaultTasks, todayIso } from "../lib/constants";
import { Modal, Btn, Input, Select, Textarea, FieldGroup, Label, Pill } from "../components/UI";

const BLANK = {
  customer: "", customerId: "", csId: "", sfOppId: "", sfOppLink: "", jiraKey: "", jiraLink: "",
  region: "EMEA", segment: "Enterprise", subscription: "Enterprise",
  oppType: "New Business", tshirt: "Standard", currency: "GBP £",
  arr: "", targetArr: "", closeDate: "", planType: "Onboarding",
  ragStatus: "green", currentStage: "opportunity",
  aeUid: "", cseUid: "", csmUid: "", taUid: "",
  modules: [], integrations: [], notes: "",
};

export default function EngagementModal({ open, onClose, initial, users, customers = [] }) {
  const { user } = useAuth();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? { ...BLANK, ...initial } : { ...BLANK });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("core");

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (field, val) => {
    const arr = form[field] || [];
    upd(field, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  // When customer name is typed, try to auto-link to a customer record
  function handleCustomerChange(name) {
    upd("customer", name);
    const match = customers.find(c => c.name?.toLowerCase() === name.toLowerCase());
    if (match) upd("customerId", match.id);
    else upd("customerId", "");
  }

  async function handleSave() {
    if (!form.customer.trim()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateDoc(doc(db, "engagements", initial.id), { ...form, updatedAt: serverTimestamp() });
      } else {
        const stageTasks = { [form.currentStage]: buildDefaultTasks(form.currentStage, todayIso()) };
        await addDoc(collection(db, "engagements"), {
          ...form, stageTasks, createdBy: user.uid,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
    }
    setSaving(false);
  }

  const TABS = [
    { id: "core", label: "Core details" },
    { id: "team", label: "Team" },
    { id: "solution", label: "Solution scope" },
    { id: "integration", label: "SF / Jira" },
  ];

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? `Edit — ${initial.customer}` : "New engagement"} width={600}>
      {/* Mini tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 18, gap: 0, margin: "-4px -4px 18px" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: "7px 14px", fontSize: 12, cursor: "pointer", background: "none",
            border: "none", borderBottom: `2px solid ${tab===t.id?"var(--purple)":"transparent"}`,
            color: tab===t.id?"var(--purple)":"var(--text-second)", fontWeight: tab===t.id?600:400,
            fontFamily: "inherit", marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      {tab === "core" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Customer name" required>
              <div style={{ position: "relative" }}>
                <Input
                  value={form.customer}
                  onChange={e => handleCustomerChange(e.target.value)}
                  placeholder="e.g. Network Rail"
                  list="customer-list"
                />
                {customers.length > 0 && (
                  <datalist id="customer-list">
                    {customers.map(c => <option key={c.id} value={c.name} />)}
                  </datalist>
                )}
              </div>
              {form.customerId && (
                <p style={{ fontSize: 11, color: "var(--green)", marginTop: 4 }}>
                  ✓ Linked to customer record
                </p>
              )}
              {form.customer && !form.customerId && customers.length > 0 && (
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  No matching customer record — will create engagement only
                </p>
              )}
            </FieldGroup>
          </div>
          <FieldGroup label="CS Request ID"><Input value={form.csId} onChange={e => upd("csId", e.target.value)} placeholder="CS-00000"/></FieldGroup>
          <FieldGroup label="Current stage">
            <Select value={form.currentStage} onChange={e => upd("currentStage", e.target.value)}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Region">
            <Select value={form.region} onChange={e => upd("region", e.target.value)}>
              {REGIONS.map(r => <option key={r}>{r}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Segment">
            <Select value={form.segment} onChange={e => upd("segment", e.target.value)}>
              {SEGMENTS.map(s => <option key={s}>{s}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Subscription">
            <Select value={form.subscription} onChange={e => upd("subscription", e.target.value)}>
              {SUBSCRIPTIONS.map(s => <option key={s}>{s}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Opportunity type">
            <Select value={form.oppType} onChange={e => upd("oppType", e.target.value)}>
              {OPP_TYPES.map(o => <option key={o}>{o}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="T-shirt size">
            <Select value={form.tshirt} onChange={e => upd("tshirt", e.target.value)}>
              {TSHIRT_SIZES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Plan type">
            <Select value={form.planType} onChange={e => upd("planType", e.target.value)}>
              {PLAN_TYPES.map(p => <option key={p}>{p}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="Currency">
            <Select value={form.currency} onChange={e => upd("currency", e.target.value)}>
              {CURRENCIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="ARR"><Input value={form.arr} onChange={e => upd("arr", e.target.value)} placeholder="e.g. 45000" type="number"/></FieldGroup>
          <FieldGroup label="Target ARR"><Input value={form.targetArr} onChange={e => upd("targetArr", e.target.value)} placeholder="e.g. 60000" type="number"/></FieldGroup>
          <FieldGroup label="Close date"><Input value={form.closeDate} onChange={e => upd("closeDate", e.target.value)} type="date"/></FieldGroup>
          <FieldGroup label="RAG status">
            <Select value={form.ragStatus} onChange={e => upd("ragStatus", e.target.value)}>
              {RAG_STATUSES.map(r => <option key={r.key} value={r.key}>{r.emoji} {r.label}</option>)}
            </Select>
          </FieldGroup>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Notes">
              <Textarea value={form.notes} onChange={e => upd("notes", e.target.value)} placeholder="Internal context, risks, key contacts..." rows={3}/>
            </FieldGroup>
          </div>
        </div>
      )}

      {tab === "team" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[["Account Executive (AE)", "aeUid"], ["CSE Owner", "cseUid"], ["CSM Owner", "csmUid"], ["Technical Architect (TA)", "taUid"]].map(([label, field]) => (
            <FieldGroup key={field} label={label}>
              <Select value={form[field]} onChange={e => upd(field, e.target.value)}>
                <option value="">— unassigned —</option>
                {users.map(u => <option key={u.uid} value={u.uid}>{u.displayName}</option>)}
              </Select>
            </FieldGroup>
          ))}
        </div>
      )}

      {tab === "solution" && (
        <div>
          <FieldGroup label="SC Modules in scope">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {SC_MODULES.map(m => {
                const sel = form.modules?.includes(m);
                return (
                  <button key={m} onClick={() => toggleArr("modules", m)} style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    border: `1px solid ${sel ? "var(--purple)" : "var(--border)"}`,
                    background: sel ? "var(--purple-light)" : "var(--surface)",
                    color: sel ? "var(--purple)" : "var(--text-second)", fontFamily: "inherit",
                  }}>{m}</button>
                );
              })}
            </div>
          </FieldGroup>
          <FieldGroup label="Integrations in scope" style={{ marginTop: 16 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
              {INTEGRATIONS.map(i => {
                const sel = form.integrations?.includes(i);
                return (
                  <button key={i} onClick={() => toggleArr("integrations", i)} style={{
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, cursor: "pointer",
                    border: `1px solid ${sel ? "var(--blue)" : "var(--border)"}`,
                    background: sel ? "var(--blue-light)" : "var(--surface)",
                    color: sel ? "var(--blue)" : "var(--text-second)", fontFamily: "inherit",
                  }}>{i}</button>
                );
              })}
            </div>
          </FieldGroup>
        </div>
      )}

      {tab === "integration" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <FieldGroup label="SF Opportunity ID"><Input value={form.sfOppId} onChange={e => upd("sfOppId", e.target.value)} placeholder="006Ol000..."/></FieldGroup>
          <FieldGroup label="SF Opportunity Link"><Input value={form.sfOppLink} onChange={e => upd("sfOppLink", e.target.value)} placeholder="https://safetyculture.lightning.force.com/..."/></FieldGroup>
          <FieldGroup label="Jira CSE Key"><Input value={form.jiraKey} onChange={e => upd("jiraKey", e.target.value)} placeholder="CSE-1234"/></FieldGroup>
          <FieldGroup label="Jira Link"><Input value={form.jiraLink} onChange={e => upd("jiraLink", e.target.value)} placeholder="https://safetyculture.atlassian.net/browse/CSE-..."/></FieldGroup>
          <div style={{ gridColumn: "1 / -1", background: "var(--surface2)", borderRadius: "var(--radius)", padding: "12px 14px", fontSize: 12, color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text-second)" }}>Coming soon:</strong> Direct Salesforce and Jira sync via API. These fields will be auto-populated once integration is configured.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 22, justifyContent: "flex-end" }}>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn onClick={handleSave} disabled={saving || !form.customer.trim()}>
          {saving ? "Saving..." : isEdit ? "Save changes" : "Create engagement"}
        </Btn>
      </div>
    </Modal>
  );
}

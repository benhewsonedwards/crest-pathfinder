import { useState } from "react";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { STAGES, REGIONS, SEGMENTS, SUBSCRIPTIONS, OPP_TYPES, TSHIRT_SIZES, CURRENCIES, PLAN_TYPES, RAG_STATUSES, SC_MODULES, INTEGRATIONS, ENHANCEMENT_STAGE_KEYS, buildDefaultTasks, buildAllStageTasks, todayIso } from "../lib/constants";
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

const BLANK_CUST = {
  name: "", sfAccountId: "", region: "EMEA", segment: "Enterprise",
  subscription: "Enterprise", arr: "", currency: "GBP £",
  industry: "", website: "", csmName: "", comName: "", aeName: "",
};

// ─── Inline customer picker ───────────────────────────────────────────────────
function CustomerPicker({ customers, value, customerId, onChange, onCreateCustomer }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newCust, setNewCust] = useState(BLANK_CUST);
  const [saving, setSaving] = useState(false);

  const filtered = customers.filter(c =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const selected = customers.find(c => c.id === customerId);

  async function handleCreate() {
    if (!newCust.name.trim()) return;
    setSaving(true);
    const ref = await addDoc(collection(db, "customers"), {
      ...newCust, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
    // Notify parent so it can select the newly created customer
    onChange(newCust.name, ref.id);
    setCreating(false);
    setOpen(false);
    setSearch("");
    setNewCust(BLANK_CUST);
    setSaving(false);
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); setCreating(false); }}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderRadius: "var(--radius-sm)",
          background: "var(--surface2)", border: `1px solid ${open ? "var(--purple)" : "var(--border)"}`,
          cursor: "pointer", fontFamily: "inherit", fontSize: 13, transition: "border-color 0.15s",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selected ? (
            <>
              <span style={{
                width: 22, height: 22, borderRadius: "var(--radius-sm)",
                background: "var(--purple-light)", color: "var(--purple)",
                fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>{selected.name.slice(0, 2).toUpperCase()}</span>
              {selected.name}
            </>
          ) : (
            <span>Select or create a customer…</span>
          )}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 100,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow-lg)",
          maxHeight: 320, display: "flex", flexDirection: "column",
        }}>
          {!creating ? (
            <>
              {/* Search */}
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search customers…"
                  style={{ fontSize: 12 }}
                  autoFocus
                />
              </div>

              {/* Customer list */}
              <div style={{ overflowY: "auto", flex: 1 }}>
                {/* Clear selection option */}
                {customerId && (
                  <button
                    type="button"
                    onClick={() => { onChange("", ""); setOpen(false); }}
                    style={{ width: "100%", padding: "8px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontSize: 12, color: "var(--text-muted)", fontFamily: "inherit", borderBottom: "1px solid var(--border)" }}
                  >
                    ✕ Clear selection
                  </button>
                )}

                {filtered.length === 0 && (
                  <p style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-muted)" }}>
                    {search ? `No customers match "${search}"` : "No customers yet"}
                  </p>
                )}

                {filtered.map(c => {
                  const isSelected = c.id === customerId;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { onChange(c.name, c.id); setOpen(false); setSearch(""); }}
                      style={{
                        width: "100%", padding: "9px 14px", background: isSelected ? "var(--purple-light)" : "none",
                        border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                        display: "flex", alignItems: "center", gap: 10,
                        borderBottom: "1px solid var(--border)",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface2)"; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "none"; }}
                    >
                      <div style={{
                        width: 26, height: 26, borderRadius: "var(--radius-sm)", flexShrink: 0,
                        background: isSelected ? "var(--purple)" : "var(--purple-light)",
                        color: isSelected ? "white" : "var(--purple)",
                        fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>{c.name.slice(0, 2).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? "var(--purple)" : "var(--text-primary)" }}>{c.name}</p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          {[c.segment, c.region, c.csmName && `CSM: ${c.csmName}`].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      {isSelected && <span style={{ fontSize: 12, color: "var(--purple)" }}>✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Add new customer */}
              <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px" }}>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)",
                    background: "var(--purple-light)", border: "1px dashed var(--purple)",
                    cursor: "pointer", color: "var(--purple)", fontSize: 12, fontWeight: 600,
                    fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  + Create new customer record
                </button>
              </div>
            </>
          ) : (
            /* Inline customer create form */
            <div style={{ padding: 14, overflowY: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 12, padding: 0, fontFamily: "inherit" }}
                >
                  ← Back
                </button>
                <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>New customer record</p>
              </div>
              <FieldGroup label="Customer name" required>
                <Input value={newCust.name} onChange={e => setNewCust(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Network Rail" autoFocus />
              </FieldGroup>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <FieldGroup label="Region">
                  <Select value={newCust.region} onChange={e => setNewCust(f => ({ ...f, region: e.target.value }))}>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </Select>
                </FieldGroup>
                <FieldGroup label="Segment">
                  <Select value={newCust.segment} onChange={e => setNewCust(f => ({ ...f, segment: e.target.value }))}>
                    {SEGMENTS.map(s => <option key={s}>{s}</option>)}
                  </Select>
                </FieldGroup>
                <FieldGroup label="CSM name">
                  <Input value={newCust.csmName} onChange={e => setNewCust(f => ({ ...f, csmName: e.target.value }))} placeholder="e.g. Hanaa Ashraf" />
                </FieldGroup>
                <FieldGroup label="ARR">
                  <Input value={newCust.arr} type="number" onChange={e => setNewCust(f => ({ ...f, arr: e.target.value }))} placeholder="e.g. 45000" />
                </FieldGroup>
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                You can fill in the rest of the details from the Customers page later.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="ghost" onClick={() => setCreating(false)} style={{ flex: 1 }}>Cancel</Btn>
                <Btn onClick={handleCreate} disabled={saving || !newCust.name.trim()} style={{ flex: 1 }}>
                  {saving ? "Creating…" : "Create & select"}
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status hint below */}
      {selected && (
        <p style={{ fontSize: 11, color: "var(--green)", marginTop: 4 }}>
          ✓ Linked to customer record — engagement will appear in their dashboard
        </p>
      )}
      {!selected && value && (
        <p style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>
          ⚠ No customer record linked — engagement will not appear in the Customers tab
        </p>
      )}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export default function EngagementModal({ open, onClose, initial, users, customers = [], engagements = [] }) {
  const { user } = useAuth();
  const isEdit = !!initial?.id;
  const [form, setForm] = useState(initial ? { ...BLANK, ...initial } : { ...BLANK });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("core");

  // Alias for warning check
  const existingEngagements = engagements;

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleArr = (field, val) => {
    const arr = form[field] || [];
    upd(field, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  async function handleSave() {
    if (!form.customer.trim()) return;
    setSaving(true);
    try {
      if (isEdit) {
        await updateDoc(doc(db, "engagements", initial.id), { ...form, updatedAt: serverTimestamp() });
      } else {
        const stageTasks = buildAllStageTasks(todayIso(), form.planType);
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
            <FieldGroup label="Customer" required>
              <CustomerPicker
                customers={customers}
                value={form.customer}
                customerId={form.customerId}
                onChange={(name, id) => { upd("customer", name); upd("customerId", id); }}
              />
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 2 }}>
              {[
                {
                  value: "Onboarding",
                  icon: "🚀",
                  title: "Onboarding",
                  desc: "First-time platform setup. COM-led onboarding included. A customer should have only one of these.",
                  colour: "#F97316",
                },
                {
                  value: "Enhancement",
                  icon: "⚡",
                  title: "Enhancement",
                  desc: "For existing customers. Covers technical requests, trials of new functionality, expansions, relaunches, and re-onboarding.",
                  colour: "#6559FF",
                },
              ].map(opt => {
                const selected = form.planType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => upd("planType", opt.value)}
                    style={{
                      textAlign: "left", padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                      border: `2px solid ${selected ? opt.colour : "var(--border)"}`,
                      background: selected ? opt.colour + "12" : "var(--surface2)",
                      transition: "all 0.15s", fontFamily: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{opt.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: selected ? opt.colour : "var(--text-primary)", marginBottom: 4 }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{opt.desc}</div>
                  </button>
                );
              })}
            </div>
            {/* Warn if selecting Onboarding and customer already has one */}
            {form.planType === "Onboarding" && form.customerId && (() => {
              const existing = (customers || []).filter(c => c.id !== form.id).find(c => c.id === form.customerId);
              // Check engagements prop for existing Onboarding for this customer
              const hasOnboarding = (existingEngagements || []).some(
                e => e.customerId === form.customerId && e.planType === "Onboarding" && e.id !== form.id
              );
              return hasOnboarding ? (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "var(--amber-light)", border: "1px solid var(--amber)", fontSize: 12, color: "var(--amber-dark, #92400e)" }}>
                  ⚠️ This customer already has an Onboarding engagement. Consider using <strong>Enhancement</strong> instead.
                </div>
              ) : null;
            })()}
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

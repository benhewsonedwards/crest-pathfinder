import { useState, useEffect } from "react";
import {
  collection, onSnapshot, query, orderBy,
  addDoc, doc, updateDoc, serverTimestamp
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { REGIONS, SEGMENTS, SUBSCRIPTIONS, CURRENCIES } from "../lib/constants";
import { integrationStatus } from "../lib/integrationConstants";
import {
  Card, CardHeader, Label, Pill, Avatar, Btn,
  Input, Select, Modal, FieldGroup, Spinner, EmptyState
} from "../components/UI";

const INDUSTRIES = [
  "Manufacturing", "Retail", "Hospitality", "Construction", "Transportation",
  "Logistics", "Healthcare", "Financial Services", "Real Estate", "Energy",
  "Utilities", "Technology", "Food & Beverage", "Aviation", "Other",
];

function StatBubble({ label, value, colour }) {
  return (
    <div style={{
      textAlign: "center", padding: "10px 14px",
      background: colour + "10", borderRadius: "var(--radius)",
      border: `1px solid ${colour}25`,
    }}>
      <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, color: colour }}>{value}</p>
      <p style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{label}</p>
    </div>
  );
}

const BLANK_CUSTOMER = {
  name: "", sfAccountId: "", region: "EMEA", segment: "Enterprise",
  subscription: "Enterprise", arr: "", currency: "GBP £",
  industry: "", website: "", employees: "",
  csmName: "", comName: "", aeName: "",
  scOrgRoleId: "", periscopeLink: "", notes: "",
};

export default function CustomersPage({ onSelectCustomer, onNewCustomer }) {
  const { profile } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(BLANK_CUSTOMER);
  const [saving, setSaving] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const canEdit = ["super_admin", "admin", "cse", "csm", "com"].includes(profile?.role);

  function openCreate() {
    setForm(BLANK_CUSTOMER);
    setEditTarget(null);
    setShowNew(true);
  }

  function openEdit(customer, e) {
    e.stopPropagation(); // don't navigate to dashboard
    setForm({
      name:         customer.name         || "",
      sfAccountId:  customer.sfAccountId  || "",
      region:       customer.region       || "EMEA",
      segment:      customer.segment      || "Enterprise",
      subscription: customer.subscription || "Enterprise",
      arr:          customer.arr          || "",
      currency:     customer.currency     || "GBP £",
      industry:     customer.industry     || "",
      website:      customer.website      || "",
      employees:    customer.employees    || "",
      csmName:      customer.csmName      || "",
      comName:      customer.comName      || "",
      aeName:       customer.aeName       || "",
      scOrgRoleId:  customer.scOrgRoleId  || "",
      periscopeLink:customer.periscopeLink|| "",
      notes:        customer.notes        || "",
    });
    setEditTarget(customer);
    setShowNew(true);
  }

  function closeModal() {
    setShowNew(false);
    setEditTarget(null);
    setForm(BLANK_CUSTOMER);
  }

  useEffect(() => {
    function handleEditEvent(e) { openEdit(e.detail, { stopPropagation: () => {} }); }
    window.addEventListener("crest:editCustomer", handleEditEvent);
    return () => window.removeEventListener("crest:editCustomer", handleEditEvent);
  }, []);

  useEffect(() => {
    // Set a fallback timeout so we never get stuck on spinner
    const timeout = setTimeout(() => setLoading(false), 5000);

    const u1 = onSnapshot(
      query(collection(db, "customers"), orderBy("name")),
      s => {
        setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
        clearTimeout(timeout);
      },
      err => {
        // orderBy("name") fails if index doesn't exist or collection is empty
        // Fall back to unordered query
        console.error("customers orderBy failed, falling back:", err.code);
        const u1b = onSnapshot(collection(db, "customers"), s => {
          setCustomers(s.docs.map(d => ({ id: d.id, ...d.data() })
          ).sort((a, b) => (a.name || "").localeCompare(b.name || "")));
          setLoading(false);
          clearTimeout(timeout);
        }, () => { setLoading(false); clearTimeout(timeout); });
        return u1b;
      }
    );
    const u2 = onSnapshot(collection(db, "integrations"), s => {
      setIntegrations(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    const u3 = onSnapshot(collection(db, "engagements"), s => {
      setEngagements(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => { clearTimeout(timeout); u1(); u2(); u3(); };
  }, []);

  function integrationsFor(customerId) {
    return integrations.filter(i => i.customerId === customerId);
  }
  function engagementsFor(customerId) {
    return engagements.filter(e => e.customerId === customerId);
  }
  function openTicketsFor(customerId) {
    const ints = integrationsFor(customerId);
    return ints.reduce((n, i) => n + (i.tickets || []).filter(t => t.status !== "done").length, 0);
  }

  const filtered = customers.filter(c => {
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (segFilter && c.segment !== segFilter) return false;
    return true;
  });

  // Aggregate stats
  const totalArr = customers.reduce((s, c) => s + (Number(c.arr) || 0), 0);
  const totalIntegrations = integrations.length;
  const liveIntegrations = integrations.filter(i => i.status === "live" || i.status === "live-attention").length;
  const needsAttention = integrations.filter(i => i.status === "broken" || i.status === "live-attention").length;

  async function saveCustomer() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editTarget?.id) {
      await updateDoc(doc(db, "customers", editTarget.id), {
        ...form, updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, "customers"), {
        ...form, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    closeModal();
    setSaving(false);
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
          <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Customers</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{customers.length} accounts · {totalIntegrations} integrations</p>
        </div>
        {canEdit && <Btn onClick={openCreate}>+ New customer</Btn>}
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBubble label="Total ARR" value={totalArr > 0 ? `£${(totalArr/1000).toFixed(0)}k` : "—"} colour="var(--green)" />
        <StatBubble label="Integrations" value={totalIntegrations} colour="var(--purple)" />
        <StatBubble label="Live integrations" value={liveIntegrations} colour="#16A34A" />
        <StatBubble label="Needs attention" value={needsAttention} colour={needsAttention > 0 ? "var(--red)" : "var(--green)"} />
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }}>🔍</span>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." style={{ paddingLeft: 30 }} />
        </div>
        <Select value={segFilter} onChange={e => setSegFilter(e.target.value)} style={{ width: 130 }}>
          <option value="">All segments</option>
          {SEGMENTS.map(s => <option key={s}>{s}</option>)}
        </Select>
        {(search || segFilter) && (
          <Btn variant="ghost" size="sm" onClick={() => { setSearch(""); setSegFilter(""); }}>Clear</Btn>
        )}
      </div>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <EmptyState icon="🏢" title="No customers yet" description="Add your first customer to start tracking their engagement and integration history"
          action={canEdit && <Btn onClick={openCreate}>+ New customer</Btn>} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(customer => {
            const ints = integrationsFor(customer.id);
            const engs = engagementsFor(customer.id);
            const openTickets = openTicketsFor(customer.id);
            const liveCount = ints.filter(i => i.status === "live" || i.status === "live-attention").length;
            const brokenCount = ints.filter(i => i.status === "broken").length;

            return (
              <Card key={customer.id} hover onClick={() => onSelectCustomer(customer)}
                style={{ cursor: "pointer" }}>
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                  {/* Logo placeholder */}
                  <div style={{
                    width: 44, height: 44, borderRadius: "var(--radius)", flexShrink: 0,
                    background: "var(--purple-light)", display: "flex", alignItems: "center",
                    justifyContent: "center", fontFamily: "Poppins, sans-serif",
                    fontWeight: 700, fontSize: 14, color: "var(--purple)",
                  }}>
                    {customer.name?.slice(0, 2).toUpperCase()}
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14 }}>{customer.name}</p>
                      <Pill color="grey" style={{ fontSize: 10 }}>{customer.segment}</Pill>
                      <Pill color="grey" style={{ fontSize: 10 }}>{customer.region}</Pill>
                      {brokenCount > 0 && <Pill color="red" style={{ fontSize: 10 }}>⚠ {brokenCount} broken</Pill>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {customer.csmName && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>CSM: {customer.csmName}</span>}
                      {customer.arr && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>ARR: £{Number(customer.arr).toLocaleString()}</span>}
                      {customer.industry && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{customer.industry}</span>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <StatBubble label="Integrations" value={ints.length} colour="var(--purple)" />
                    <StatBubble label="Live" value={liveCount} colour="var(--green)" />
                    <StatBubble label="Open tickets" value={openTickets} colour={openTickets > 0 ? "var(--amber)" : "var(--text-muted)"} />
                    <StatBubble label="Engagements" value={engs.length} colour="var(--blue)" />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8, flexShrink: 0 }}>
                    {canEdit && (
                      <button
                        onClick={e => openEdit(customer, e)}
                        style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", cursor: "pointer", color: "var(--text-muted)", fontSize: 11, padding: "4px 10px", fontFamily: "inherit", transition: "all 0.13s" }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--purple)"; e.currentTarget.style.color = "var(--purple)"; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                      >
                        Edit
                      </button>
                    )}
                    <span style={{ color: "var(--text-muted)", fontSize: 18 }}>›</span>
                  </div>
                </div>

                {/* Integration pills */}
                {ints.length > 0 && (
                  <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {ints.map(i => {
                      const st = integrationStatus(i.status);
                      return (
                        <span key={i.id} style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          padding: "2px 10px", borderRadius: 999, fontSize: 11,
                          background: st.bg, color: st.colour, fontWeight: 500,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.colour, flexShrink: 0 }} />
                          {i.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit customer modal */}
      <Modal open={showNew} onClose={closeModal} title={editTarget ? `Edit — ${editTarget.name}` : "New customer"} width={580}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Customer name" required>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Norse Group" />
            </FieldGroup>
          </div>
          <FieldGroup label="SF Account ID"><Input value={form.sfAccountId} onChange={e => setForm(f => ({ ...f, sfAccountId: e.target.value }))} placeholder="0015i00000..." /></FieldGroup>
          <FieldGroup label="Region"><Select value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}>{REGIONS.map(r => <option key={r}>{r}</option>)}</Select></FieldGroup>
          <FieldGroup label="Segment"><Select value={form.segment} onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}>{SEGMENTS.map(s => <option key={s}>{s}</option>)}</Select></FieldGroup>
          <FieldGroup label="Subscription"><Select value={form.subscription} onChange={e => setForm(f => ({ ...f, subscription: e.target.value }))}>{SUBSCRIPTIONS.map(s => <option key={s}>{s}</option>)}</Select></FieldGroup>
          <FieldGroup label="ARR"><Input value={form.arr} onChange={e => setForm(f => ({ ...f, arr: e.target.value }))} type="number" placeholder="e.g. 45000" /></FieldGroup>
          <FieldGroup label="Currency"><Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>{["GBP £","USD $","EUR €","AUD $"].map(c => <option key={c}>{c}</option>)}</Select></FieldGroup>
          <FieldGroup label="Industry"><Select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))}><option value="">— select —</option>{INDUSTRIES.map(i => <option key={i}>{i}</option>)}</Select></FieldGroup>
          <FieldGroup label="Website"><Input value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} placeholder="www.example.com" /></FieldGroup>
          <FieldGroup label="Employees"><Input value={form.employees} onChange={e => setForm(f => ({ ...f, employees: e.target.value }))} placeholder="e.g. 5000" /></FieldGroup>
          <FieldGroup label="CSM Name"><Input value={form.csmName} onChange={e => setForm(f => ({ ...f, csmName: e.target.value }))} placeholder="e.g. Hanaa Ashraf" /></FieldGroup>
          <FieldGroup label="COM Name"><Input value={form.comName} onChange={e => setForm(f => ({ ...f, comName: e.target.value }))} placeholder="e.g. Alice Kirkup" /></FieldGroup>
          <FieldGroup label="AE Name"><Input value={form.aeName} onChange={e => setForm(f => ({ ...f, aeName: e.target.value }))} /></FieldGroup>
          <FieldGroup label="SC Org Role ID"><Input value={form.scOrgRoleId} onChange={e => setForm(f => ({ ...f, scOrgRoleId: e.target.value }))} placeholder="role_..." /></FieldGroup>
          <div style={{ gridColumn: "1 / -1" }}>
            <FieldGroup label="Periscope Link"><Input value={form.periscopeLink} onChange={e => setForm(f => ({ ...f, periscopeLink: e.target.value }))} placeholder="https://tools.safetyculture.com/..." /></FieldGroup>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 18 }}>
          <Btn variant="ghost" onClick={closeModal}>Cancel</Btn>
          <Btn onClick={saveCustomer} disabled={saving || !form.name.trim()}>
            {saving ? "Saving..." : editTarget ? "Save changes" : "Create customer"}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}

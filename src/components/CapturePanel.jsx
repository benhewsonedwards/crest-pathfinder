import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Label, Pill } from "./UI";

// ─── Capture schemas per stage ────────────────────────────────────────────────
export const CAPTURE_SCHEMAS = {
  opportunity: {
    title: "Pre-Engagement Checklist",
    sections: [
      { heading: "Eligibility", fields: [
        { key: "enterprise_confirmed",   label: "Enterprise plan confirmed",         type: "yesno",  critical: true  },
        { key: "ae_handover_reviewed",   label: "AE handover notes reviewed",        type: "yesno",  critical: true  },
        { key: "prior_attempt",          label: "Prior implementation attempt?",     type: "yesno",  critical: false, neutral: true },
        { key: "prior_attempt_notes",    label: "Prior attempt notes",               type: "textarea", critical: false, showIf: { key: "prior_attempt", val: "Yes" } },
      ]},
      { heading: "Engagement Type", fields: [
        { key: "engagement_types",       label: "Engagement type(s)",                type: "multiselect", critical: true,
          options: ["SSO Setup","SCIM Provisioning","API & Data Integration","TA Discovery","Automation / Workato","BI & Reporting","Platform Onboarding (COM)"] },
        { key: "csi_involvement",        label: "CS&I involvement needed",           type: "yesno",  critical: true  },
        { key: "csi_reason",             label: "Reason / notes",                    type: "textarea", critical: false },
      ]},
      { heading: "Qualifying Flags", fields: [
        { key: "flag_multi_bu",          label: "Multiple business units in scope",  type: "yesno",  critical: false, neutral: true },
        { key: "flag_integration",       label: "Integration required to go live",   type: "yesno",  critical: false, neutral: true },
        { key: "flag_large_arr",         label: "Large ARR (Enterprise tier)",       type: "yesno",  critical: false, neutral: true },
        { key: "flag_multi_region",      label: "Multi-region rollout",              type: "yesno",  critical: false, neutral: true },
        { key: "ta_involvement",         label: "TA involvement required",           type: "yesno",  critical: false, neutral: true },
      ]},
    ],
  },

  requirements: {
    title: "Requirements & Scoping",
    sections: [
      { heading: "Stakeholders", fields: [
        { key: "primary_contact",        label: "Primary contact (name & role)",     type: "text",   critical: true  },
        { key: "primary_contact_email",  label: "Primary contact email",             type: "text",   critical: true  },
        { key: "it_contact",             label: "IT contact (IdP / API admin)",      type: "text",   critical: false },
        { key: "exec_sponsor",           label: "Executive sponsor",                 type: "text",   critical: false },
        { key: "end_user_manager",       label: "End-user / frontline manager",      type: "text",   critical: false },
        { key: "runbook_recipient",      label: "Config runbook recipient",          type: "text",   critical: true  },
      ]},
      { heading: "Onboarding Track", fields: [
        { key: "primary_use_cases",      label: "Primary use case(s)",               type: "multiselect", critical: true,
          options: ["Inspections & Audits","Incident / Hazard Reporting","Training / LMS","Contractor Management","Lone Worker","Site Inductions","Actions"] },
        { key: "success_criteria",       label: "Success criteria — what does done look like?", type: "textarea", critical: true },
        { key: "mvp_scope",              label: "MVP scope for this onboarding",     type: "textarea", critical: true  },
        { key: "total_users",            label: "Total user count",                  type: "text",   critical: true  },
        { key: "users_admin",            label: "Admins",                            type: "text",   critical: false },
        { key: "users_frontline",        label: "Frontline workers",                 type: "text",   critical: false },
        { key: "sites_list",             label: "Key sites / locations",             type: "textarea", critical: true },
        { key: "language_needs",         label: "Language / localisation needs",     type: "text",   critical: false },
      ]},
      { heading: "CSE / TA — Universal", fields: [
        { key: "go_live_date",           label: "Target go-live date",               type: "date",   critical: true  },
        { key: "go_live_hard",           label: "Deadline type",                     type: "select", critical: true,
          options: ["Soft","Hard — regulatory","Hard — internal commitment","Hard — contractual"] },
        { key: "blackout_periods",       label: "Blackout / unavailable periods",    type: "textarea", critical: false },
        { key: "security_constraints",   label: "Security / compliance constraints", type: "textarea", critical: false },
        { key: "integration_platform",   label: "Existing integration platform",     type: "select", critical: false,
          options: ["None","Workato","Zapier","Make (Integromat)","Power Automate","MuleSoft","Dell Boomi","Azure Logic Apps","SAP BTP / CPI","Other"] },
      ]},
      { heading: "SSO / SCIM", collapsible: true, showIf: { key: "engagement_types", anyOf: ["SSO Setup","SCIM Provisioning"] }, fields: [
        { key: "idp_name",               label: "Identity provider (IdP)",           type: "select", critical: true,
          options: ["Okta","Microsoft Azure AD / Entra ID","Google Workspace","Ping Identity","ADFS (v3.0+)","OneLogin","JumpCloud","Other / Custom"] },
        { key: "sso_scim_both",          label: "Requirement",                       type: "select", critical: true,
          options: ["SSO only","SCIM only","Both SSO and SCIM"] },
        { key: "sso_flow",               label: "SSO flow type",                     type: "select", critical: false,
          options: ["SP-initiated (default)","IdP-initiated"] },
        { key: "metadata_received",      label: "IdP metadata XML / URL received",   type: "yesno",  critical: true  },
        { key: "mfa_policy",             label: "MFA enforced at IdP level?",        type: "yesno",  critical: false, neutral: true },
        { key: "deprov_policy",          label: "Deprovisioning policy",             type: "select", critical: false,
          options: ["Deactivate user","Delete user","Manual review"] },
        { key: "it_admin_confirmed",     label: "IT admin confirmed for session 1",  type: "yesno",  critical: true  },
      ]},
      { heading: "API & Data Integration", collapsible: true, showIf: { key: "engagement_types", anyOf: ["API & Data Integration","Automation / Workato","BI & Reporting"] }, fields: [
        { key: "systems_inventory",      label: "Systems to connect (name, direction, owner)", type: "textarea", critical: true },
        { key: "data_direction",         label: "Data flow direction",               type: "select", critical: true,
          options: ["Read-only from SafetyCulture","Write to SafetyCulture","Bidirectional"] },
        { key: "datasets_in_scope",      label: "Datasets in scope",                 type: "multiselect", critical: true,
          options: ["Inspections / Audits","Actions","Issues","Users","Training","All"] },
        { key: "refresh_frequency",      label: "Required refresh frequency",        type: "select", critical: true,
          options: ["Real-time (webhooks)","Hourly","Daily batch","On-demand"] },
        { key: "api_token_confirmed",    label: "Active API token confirmed",         type: "yesno",  critical: true  },
        { key: "developer_available",    label: "Internal developer available",       type: "yesno",  critical: true  },
      ]},
      { heading: "TA Discovery", collapsible: true, showIf: { key: "engagement_types", anyOf: ["TA Discovery"] }, fields: [
        { key: "business_problem",       label: "Business problem statement",         type: "textarea", critical: true },
        { key: "sap_version",            label: "SAP version",                        type: "select", critical: false,
          options: ["N/A","ECC 6.0","S/4HANA on-prem","S/4HANA Cloud","BTP","Unknown"] },
        { key: "tech_decision_maker",    label: "Technical decision-maker",           type: "text",   critical: true  },
        { key: "biz_decision_maker",     label: "Business sign-off owner",            type: "text",   critical: true  },
      ]},
    ],
  },

  "technical-review": {
    title: "Technical Session Tracker",
    sections: [
      { heading: "Pre-Engagement Prep", fields: [
        { key: "questionnaire_sent",     label: "Pre-call questionnaire sent",        type: "yesnodate", critical: true  },
        { key: "right_attendees",        label: "Right attendees confirmed (IT admin / dev)", type: "yesno", critical: true },
        { key: "existing_config",        label: "Existing SC configuration reviewed", type: "yesno",  critical: false },
        { key: "resources_prepared",     label: "Setup guides / templates prepared",  type: "yesno",  critical: false },
      ]},
      { heading: "Session Log", fields: [
        { key: "session1_date",          label: "Session 1 — Discovery date",         type: "date",   critical: true  },
        { key: "session1_attendees",     label: "Session 1 attendees",                type: "text",   critical: true  },
        { key: "session1_outcome",       label: "Session 1 outcome / scope agreed",   type: "textarea", critical: true },
        { key: "session2_date",          label: "Session 2 — Configuration date",     type: "date",   critical: false },
        { key: "session3_date",          label: "Session 3 — Testing / go-live date", type: "date",   critical: false },
      ]},
      { heading: "Escalation Flags", fields: [
        { key: "esc_custom_api",         label: "Custom API development needed → Product", type: "yesno", critical: false, neutral: true },
        { key: "esc_sap_bapi",           label: "SAP BAPI/RFC integration → TA / middleware", type: "yesno", critical: false, neutral: true },
        { key: "esc_data_residency",     label: "Data residency requirements → Legal", type: "yesno",  critical: false, neutral: true },
        { key: "escalation_notes",       label: "Escalation notes",                   type: "textarea", critical: false },
      ]},
    ],
  },

  onboarding: {
    title: "Onboarding Kickoff Data",
    sections: [
      { heading: "Kickoff Checklist", fields: [
        { key: "deck_prepared",          label: "Kickoff deck customised",            type: "yesno",     critical: true  },
        { key: "kickoff_completed",      label: "Kickoff call completed",             type: "yesnodate", critical: true  },
        { key: "recap_email_sent",       label: "Recap email sent within 24h",        type: "yesnodate", critical: true  },
        { key: "sessions_scheduled",     label: "All sessions scheduled",             type: "yesno",     critical: true  },
        { key: "crm_updated",            label: "CRM updated (use case, go-live, stakeholders)", type: "yesno", critical: true },
        { key: "integration_flagged",    label: "Integration requirements flagged to CSE", type: "yesno", critical: false, neutral: true },
      ]},
      { heading: "Customer Homework", fields: [
        { key: "user_list_received",     label: "User list received",                 type: "yesnodate", critical: true  },
        { key: "site_list_received",     label: "Site list received",                 type: "yesnodate", critical: true  },
        { key: "templates_received",     label: "Priority templates received",        type: "yesnodate", critical: true  },
        { key: "templates_detail",       label: "Templates detail (names/count)",     type: "text",   critical: false },
        { key: "guided_training_assigned", label: "Guided training assigned in-account", type: "yesno", critical: true },
      ]},
      { heading: "Onboarding Program", fields: [
        { key: "session_cadence",        label: "Agreed session cadence",             type: "select", critical: true,
          options: ["Weekly (standard)","Bi-weekly","Fortnightly","Flexible"] },
        { key: "training_format",        label: "End-user training format",           type: "select", critical: true,
          options: ["Virtual sessions","In-person","Train-the-trainer","Self-serve"] },
        { key: "capacity_constraints",   label: "Customer blackouts / constraints",   type: "textarea", critical: false },
        { key: "large_rollout",          label: "Large / complex rollout (phasing required)?", type: "yesno", critical: false, neutral: true },
      ]},
    ],
  },

  "solution-delivery": {
    title: "Delivery & Build",
    sections: [
      { heading: "Build Details", fields: [
        { key: "solution_type",          label: "Solution type",                      type: "select", critical: true,
          options: ["SSO configuration","SCIM provisioning","API integration","Workato automation","BI connector","Custom build","Multiple"] },
        { key: "scope_confirmed",        label: "Scope agreed and signed off",        type: "yesno",  critical: true  },
        { key: "iteration_limit",        label: "Agreed iteration / change cycle limit", type: "text", critical: false },
        { key: "poc_notes",              label: "PoC build notes / key decisions",    type: "textarea", critical: false },
        { key: "uat_notes",              label: "UAT feedback summary",               type: "textarea", critical: false },
      ]},
      { heading: "Handover Documentation", fields: [
        { key: "runbook_produced",       label: "Configuration runbook produced",     type: "yesno",  critical: true  },
        { key: "test_procedure",         label: "Test procedure documented",          type: "yesno",  critical: true  },
        { key: "customer_holds_creds",   label: "Customer holds all credentials (tokens, certs)", type: "yesno", critical: true },
        { key: "cert_expiry",            label: "Certificate / token expiry dates noted", type: "text", critical: true },
        { key: "support_intro",          label: "Support ticket process introduced",  type: "yesno",  critical: true  },
      ]},
      { heading: "Risk Log", fields: [
        { key: "open_risks",             label: "Open technical risks not resolved",  type: "textarea", critical: false },
        { key: "risks_flagged_csm",      label: "Open risks flagged to CSM",          type: "yesno",  critical: false, neutral: true },
        { key: "post_issues_covered",    label: "Post-engagement issues covered in handover", type: "yesno", critical: true },
      ]},
    ],
  },

  "go-live": {
    title: "Go-Live & Closure",
    sections: [
      { heading: "Go-Live Confirmation", fields: [
        { key: "go_live_actual_date",    label: "Actual go-live date",                type: "date",   critical: true  },
        { key: "hypercare_end",          label: "Hypercare end date",                 type: "date",   critical: true  },
        { key: "monitoring_notes",       label: "Hypercare monitoring notes",         type: "textarea", critical: false },
      ]},
      { heading: "Formal Closure", fields: [
        { key: "runbook_delivered",      label: "Config runbook delivered to IT contact", type: "yesno", critical: true },
        { key: "sf_closed",              label: "Engagement closed in Salesforce",    type: "yesno",  critical: true  },
        { key: "csm_handover_complete",  label: "CSM handover complete",              type: "yesno",  critical: true  },
        { key: "expansion_noted",        label: "Expansion opportunities identified", type: "yesno",  critical: false, neutral: true },
        { key: "expansion_notes",        label: "Expansion notes",                    type: "textarea", critical: false, showIf: { key: "expansion_noted", val: "Yes" } },
      ]},
      { heading: "Post-Engagement Watch", fields: [
        { key: "sso_cert_expiry",        label: "SSO certificate expiry date",        type: "date",   critical: false },
        { key: "api_token_rotation",     label: "API token rotation schedule noted",  type: "yesno",  critical: false, neutral: true },
        { key: "scim_monitoring",        label: "SCIM provisioning monitoring advised", type: "yesno", critical: false, neutral: true },
        { key: "rate_limit_briefed",     label: "API rate limit expectations set",    type: "yesno",  critical: false, neutral: true },
      ]},
    ],
  },

  "csm-ongoing": {
    title: "Ongoing Engagement",
    sections: [
      { heading: "Adoption Milestones", fields: [
        { key: "day30_review",           label: "30-day adoption review",             type: "yesnodate", critical: true  },
        { key: "day30_notes",            label: "30-day review notes",                type: "textarea", critical: false },
        { key: "first_qbr",              label: "First QBR completed",                type: "yesnodate", critical: true  },
        { key: "first_qbr_notes",        label: "QBR notes / outcomes",              type: "textarea", critical: false },
      ]},
      { heading: "Renewal", fields: [
        { key: "renewal_date",           label: "Renewal date",                       type: "date",   critical: false },
        { key: "renewal_risk",           label: "Renewal at risk?",                   type: "yesno",  critical: false, neutral: true },
        { key: "expansion_opportunity",  label: "Expansion opportunity notes",        type: "textarea", critical: false },
      ]},
    ],
  },
};

// ─── Completeness calculator ──────────────────────────────────────────────────
export function captureCompleteness(stageKey, data = {}) {
  const schema = CAPTURE_SCHEMAS[stageKey];
  if (!schema) return null;
  let critical = 0, criticalDone = 0, total = 0, totalDone = 0;
  schema.sections.forEach(sec => {
    sec.fields.forEach(f => {
      if (f.showIf && !f.showIf.anyOf) {
        const pv = data[f.showIf.key] || "";
        if (pv !== f.showIf.val) return;
      }
      total++;
      const v = data[f.key];
      const filled = v && v !== "" && !(Array.isArray(v) && v.length === 0) &&
        !(typeof v === "object" && !Array.isArray(v) && !v?.yn);
      if (filled) totalDone++;
      if (f.critical) { critical++; if (filled) criticalDone++; }
    });
  });
  return {
    critical, criticalDone, total, totalDone,
    pct: total > 0 ? Math.round((totalDone / total) * 100) : 0,
    criticalPct: critical > 0 ? Math.round((criticalDone / critical) * 100) : 100,
  };
}

// ─── Individual field renderer ────────────────────────────────────────────────
function CaptureField({ field, value, onChange, allData }) {
  if (field.showIf && !field.showIf.anyOf) {
    if ((allData[field.showIf.key] || "") !== field.showIf.val) return null;
  }

  const isEmpty = !value || value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && !Array.isArray(value) && !value?.yn);
  const warn = field.critical && isEmpty;

  const labelEl = (
    <div style={{ marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>{field.label}</span>
      {field.critical && <span style={{ fontSize: 9, color: "var(--red)", fontWeight: 700, textTransform: "uppercase" }}>critical</span>}
    </div>
  );

  const inputStyle = {
    width: "100%", padding: "7px 10px", fontSize: 13,
    border: `1px solid ${warn ? "rgba(220,38,38,0.4)" : "var(--border)"}`,
    borderRadius: "var(--radius-sm)", background: "var(--surface)",
    color: "var(--text-primary)", fontFamily: "inherit", outline: "none",
  };

  if (field.type === "yesno") return (
    <div style={{ marginBottom: 12 }}>
      {labelEl}
      <div style={{ display: "flex", gap: 6 }}>
        {["Yes", "No"].map(opt => {
          const isSelected = value === opt;
          let bg, border, color;
          if (isSelected) {
            if (field.neutral) {
              bg = "var(--purple-light)"; border = "var(--purple)"; color = "var(--purple)";
            } else {
              bg = opt === "Yes" ? "var(--green-light)" : "var(--red-light)";
              border = opt === "Yes" ? "var(--green)" : "var(--red)";
              color = opt === "Yes" ? "var(--green)" : "var(--red)";
            }
          } else {
            bg = "var(--surface)"; border = "var(--border)"; color = "var(--text-second)";
          }
          return (
            <button key={opt} onClick={() => onChange(value === opt ? "" : opt)} style={{
              padding: "5px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
              border: `1px solid ${border}`, background: bg, color,
            }}>{opt}</button>
          );
        })}
        {value && <button onClick={() => onChange("")} style={{ padding: "5px 8px", borderRadius: 6, fontSize: 11, cursor: "pointer", background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "inherit" }}>clear</button>}
      </div>
      {warn && <p style={{ fontSize: 10, color: "var(--amber)", marginTop: 3 }}>⚠ Required before advancing stage</p>}
    </div>
  );

  if (field.type === "yesnodate") {
    const p = (value && typeof value === "object") ? value : {};
    const upd = (k, v) => onChange({ ...p, [k]: v });
    return (
      <div style={{ marginBottom: 12 }}>
        {labelEl}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["Yes", "No"].map(opt => {
              const isSelected = p.yn === opt;
              let bg, border, color;
              if (isSelected) {
                if (field.neutral) {
                  bg = "var(--purple-light)"; border = "var(--purple)"; color = "var(--purple)";
                } else {
                  bg = opt === "Yes" ? "var(--green-light)" : "var(--red-light)";
                  border = opt === "Yes" ? "var(--green)" : "var(--red)";
                  color = opt === "Yes" ? "var(--green)" : "var(--red)";
                }
              } else {
                bg = "var(--surface)"; border = "var(--border)"; color = "var(--text-second)";
              }
              return (
                <button key={opt} onClick={() => upd("yn", p.yn === opt ? "" : opt)} style={{
                  padding: "5px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${border}`, background: bg, color,
                }}>{opt}</button>
              );
            })}
          </div>
          {p.yn === "Yes" && (
            <input type="date" value={p.date || ""} onChange={e => upd("date", e.target.value)}
              style={{ ...inputStyle, maxWidth: 150, padding: "5px 8px" }}/>
          )}
        </div>
        {warn && <p style={{ fontSize: 10, color: "var(--amber)", marginTop: 3 }}>⚠ Required before advancing stage</p>}
      </div>
    );
  }

  if (field.type === "multiselect") {
    const sel = Array.isArray(value) ? value : [];
    return (
      <div style={{ marginBottom: 12 }}>
        {labelEl}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {field.options.map(opt => {
            const active = sel.includes(opt);
            return (
              <button key={opt} onClick={() => onChange(active ? sel.filter(x => x !== opt) : [...sel, opt])} style={{
                padding: "3px 10px", borderRadius: 999, fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                border: `1px solid ${active ? "var(--purple)" : "var(--border)"}`,
                background: active ? "var(--purple-light)" : "var(--surface)",
                color: active ? "var(--purple)" : "var(--text-second)",
              }}>{opt}</button>
            );
          })}
        </div>
        {warn && <p style={{ fontSize: 10, color: "var(--amber)", marginTop: 3 }}>⚠ Required before advancing stage</p>}
      </div>
    );
  }

  if (field.type === "select") return (
    <div style={{ marginBottom: 12 }}>
      {labelEl}
      <select value={value || ""} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
        <option value="">— select —</option>
        {field.options.map(o => <option key={o}>{o}</option>)}
      </select>
      {warn && <p style={{ fontSize: 10, color: "var(--amber)", marginTop: 3 }}>⚠ Required</p>}
    </div>
  );

  if (field.type === "textarea") return (
    <div style={{ marginBottom: 12 }}>
      {labelEl}
      <textarea value={value || ""} onChange={e => onChange(e.target.value)} rows={3}
        style={{ ...inputStyle, resize: "vertical", minHeight: 60 }}/>
      {warn && <p style={{ fontSize: 10, color: "var(--amber)", marginTop: 3 }}>⚠ Required</p>}
    </div>
  );

  if (field.type === "date") return (
    <div style={{ marginBottom: 12 }}>
      {labelEl}
      <input type="date" value={value || ""} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, maxWidth: 180 }}/>
      {warn && <p style={{ fontSize: 10, color: "var(--amber)", marginTop: 3 }}>⚠ Required</p>}
    </div>
  );

  return (
    <div style={{ marginBottom: 12 }}>
      {labelEl}
      <input value={value || ""} onChange={e => onChange(e.target.value)} style={inputStyle}/>
      {warn && <p style={{ fontSize: 10, color: "var(--amber)", marginTop: 3 }}>⚠ Required</p>}
    </div>
  );
}

// ─── Main capture panel ───────────────────────────────────────────────────────
export default function CapturePanel({ engagementId, stageKey, captureData = {}, allStageCapture = {}, canEdit = true }) {
  const schema = CAPTURE_SCHEMAS[stageKey];
  const [localData, setLocalData] = useState(captureData);
  const [collapsed, setCollapsed] = useState({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const comp = captureCompleteness(stageKey, localData);

  function secVisible(sec) {
    if (!sec.showIf) return true;
    const reqData = allStageCapture?.requirements || {};
    const vals = reqData[sec.showIf.key] || [];
    if (sec.showIf.anyOf) return sec.showIf.anyOf.some(v => Array.isArray(vals) ? vals.includes(v) : vals === v);
    return false;
  }

  function updateField(key, val) {
    setLocalData(d => ({ ...d, [key]: val }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    await updateDoc(doc(db, "engagements", engagementId), {
      [`stageCapture.${stageKey}`]: localData,
      updatedAt: serverTimestamp(),
    });
    setDirty(false);
    setSaving(false);
  }

  if (!schema) return <p style={{ fontSize: 13, color: "var(--text-muted)", padding: "20px 0" }}>No data capture form for this stage.</p>;

  return (
    <div>
      {/* Progress bar */}
      {comp && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius)", marginBottom: 16, border: "1px solid var(--border)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Data capture</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: comp.pct === 100 ? "var(--green)" : "var(--text-second)" }}>{comp.totalDone}/{comp.total} fields</span>
            </div>
            <div style={{ height: 4, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${comp.pct}%`, background: comp.pct===100?"var(--green)":"linear-gradient(90deg,var(--purple),var(--blue))", borderRadius: 99, transition: "width 0.4s" }}/>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: comp.criticalPct === 100 ? "var(--green)" : "var(--amber)" }}>
              {comp.criticalDone}/{comp.critical} critical
            </span>
          </div>
          {dirty && canEdit && (
            <button onClick={save} disabled={saving} style={{
              padding: "5px 12px", borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer",
              background: "var(--purple)", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600,
            }}>
              {saving ? "Saving..." : "Save"}
            </button>
          )}
        </div>
      )}

      {/* Sections */}
      {schema.sections.map((sec, si) => {
        if (!secVisible(sec)) return null;
        const isOpen = !(collapsed[si] ?? (sec.collapsible ?? false));
        const secCritTotal = sec.fields.filter(f => {
          if (f.showIf && !f.showIf.anyOf) { const v = localData[f.showIf.key]||""; return v===f.showIf.val && f.critical; }
          return f.critical;
        }).length;
        const secCritDone = sec.fields.filter(f => {
          if (f.showIf && !f.showIf.anyOf) { const v = localData[f.showIf.key]||""; if (v!==f.showIf.val) return false; }
          if (!f.critical) return false;
          const v = localData[f.key];
          return v && v !== "" && !(Array.isArray(v)&&v.length===0) && !(typeof v==="object"&&!Array.isArray(v)&&!v?.yn);
        }).length;

        return (
          <div key={si} style={{ marginBottom: 12 }}>
            <div onClick={() => setCollapsed(c => ({ ...c, [si]: isOpen }))} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", background: "var(--surface2)", borderRadius: isOpen ? "var(--radius-sm) var(--radius-sm) 0 0" : "var(--radius-sm)",
              border: "1px solid var(--border)", cursor: "pointer", userSelect: "none",
              borderBottom: isOpen ? "none" : "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{sec.heading}</span>
                {secCritTotal > 0 && (
                  <span style={{ fontSize: 9, background: secCritDone===secCritTotal?"var(--green-light)":"var(--amber-light)", color: secCritDone===secCritTotal?"var(--green)":"var(--amber)", padding: "1px 6px", borderRadius: 999, fontWeight: 700 }}>
                    {secCritDone}/{secCritTotal} critical
                  </span>
                )}
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: 13, transition: "0.2s", transform: isOpen ? "rotate(180deg)" : "none", display: "inline-block" }}>⌄</span>
            </div>
            {isOpen && (
              <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 var(--radius-sm) var(--radius-sm)", padding: "14px 14px 2px" }}>
                {sec.fields.map((field, fi) => (
                  <CaptureField key={fi} field={field} value={localData[field.key]}
                    onChange={v => canEdit && updateField(field.key, v)} allData={localData}/>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {dirty && canEdit && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={save} disabled={saving} style={{
            padding: "8px 16px", borderRadius: "var(--radius)", fontSize: 13, cursor: "pointer",
            background: "var(--purple)", color: "#fff", border: "none", fontFamily: "inherit", fontWeight: 600,
          }}>
            {saving ? "Saving..." : "Save capture data"}
          </button>
        </div>
      )}
    </div>
  );
}

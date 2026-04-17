// ─── Integration statuses ─────────────────────────────────────────────────────
export const INTEGRATION_STATUSES = [
  { key: "scoping",         label: "Scoping",              colour: "#64748B", bg: "#F1F5F9" },
  { key: "in-build",        label: "In Build",             colour: "#8B5CF6", bg: "#EDE9FE" },
  { key: "testing",         label: "Testing",              colour: "#F97316", bg: "#FFEDD5" },
  { key: "live",            label: "Live",                 colour: "#16A34A", bg: "#DCFCE7" },
  { key: "live-attention",  label: "Live — Needs Attention", colour: "#D97706", bg: "#FEF3C7" },
  { key: "broken",          label: "Broken",               colour: "#DC2626", bg: "#FEE2E2" },
  { key: "decommissioned",  label: "Decommissioned",       colour: "#94A3B8", bg: "#F8FAFC" },
];

// ─── Integration categories ───────────────────────────────────────────────────
export const INTEGRATION_CATEGORIES = [
  "User Provisioning / SCIM",
  "SSO",
  "Data Sync",
  "Process Automation",
  "Reporting / BI",
  "Notifications",
  "File Transfer",
  "ERP Integration",
  "HRIS Integration",
  "Custom API",
  "Other",
];

// ─── Ticket types for follow-on tickets ──────────────────────────────────────
export const TICKET_TYPES = [
  { key: "initial",       label: "Initial CSR",           colour: "#6559FF" },
  { key: "bug-fix",       label: "Bug Fix",               colour: "#DC2626" },
  { key: "enhancement",   label: "Enhancement",           colour: "#8B5CF6" },
  { key: "config-change", label: "Configuration Change",  colour: "#F97316" },
  { key: "monitoring",    label: "Monitoring",            colour: "#0EA5E9" },
];

// ─── Workato environments ─────────────────────────────────────────────────────
export const WORKATO_ENVS = ["US", "EU", "AU", "SG", "JP"];

// ─── Data flow directions ─────────────────────────────────────────────────────
export const DATA_DIRECTIONS = [
  "One-way (SC → External)",
  "One-way (External → SC)",
  "Bidirectional",
];

// ─── Trigger types ────────────────────────────────────────────────────────────
export const TRIGGER_TYPES = [
  "Scheduled",
  "Event-driven (Webhook)",
  "API Call (On-demand)",
  "Manual",
];

// ─── Feasibility ratings ──────────────────────────────────────────────────────
export const FEASIBILITY = [
  { key: "green",  label: "Green — Feasible",     colour: "#16A34A", bg: "#DCFCE7" },
  { key: "amber",  label: "Amber — Concerns",     colour: "#D97706", bg: "#FEF3C7" },
  { key: "red",    label: "Red — Blockers",       colour: "#DC2626", bg: "#FEE2E2" },
];

// ─── Business impact ──────────────────────────────────────────────────────────
export const BUSINESS_IMPACT = ["Low", "Medium", "High"];

// ─── Helper ───────────────────────────────────────────────────────────────────
export function integrationStatus(key) {
  return INTEGRATION_STATUSES.find(s => s.key === key) || INTEGRATION_STATUSES[0];
}

export function ticketType(key) {
  return TICKET_TYPES.find(t => t.key === key) || TICKET_TYPES[0];
}

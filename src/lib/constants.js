// ─── Lifecycle stages ─────────────────────────────────────────────────────────
export const STAGES = [
  { key: "opportunity",       label: "Opportunity",           shortLabel: "Opp",   colour: "#64748B", icon: "💼", description: "Deal in pipeline — Sales discovery, CS&I flagged" },
  { key: "requirements",      label: "Requirements",          shortLabel: "Req",   colour: "#3B82F6", icon: "📋", description: "Scoping sessions — capture integration needs, go-live targets" },
  { key: "technical-review",  label: "Technical Review",      shortLabel: "Tech",  colour: "#8B5CF6", icon: "🔬", description: "CSE solution design, architecture, feasibility" },
  { key: "onboarding",        label: "Onboarding",            shortLabel: "Onb",   colour: "#F97316", icon: "🚀", description: "COM-led platform onboarding — templates, users, training" },
  { key: "solution-delivery", label: "Solution Delivery",     shortLabel: "Del",   colour: "#6559FF", icon: "⚙️",  description: "CSE integration build, PoC, testing, iteration" },
  { key: "go-live",           label: "Go-Live / Handover",    shortLabel: "Live",  colour: "#16A34A", icon: "🎯", description: "Production deployment, hypercare, CSE → CSM handover" },
  { key: "csm-ongoing",       label: "Ongoing (CSM)",         shortLabel: "CSM",   colour: "#0EA5E9", icon: "📊", description: "CSM-managed ongoing engagement — QBRs, adoption, renewals" },
];
export const STAGE_KEYS = STAGES.map(s => s.key);

// ─── Roles ─────────────────────────────────────────────────────────────────────
export const ROLES = [
  { key: "super_admin", label: "Super Admin",   description: "Full access — manage users, teams, all engagements" },
  { key: "admin",       label: "Admin",         description: "Manage engagements and team members" },
  { key: "cse",         label: "CSE",           description: "Customer Success Engineer — manage own engagements" },
  { key: "csm",         label: "CSM",           description: "Customer Success Manager — view and update onboarding/ongoing" },
  { key: "com",         label: "COM",           description: "Customer Onboarding Manager" },
  { key: "ae",          label: "AE",            description: "Account Executive — view pipeline, add opportunities" },
  { key: "ta",          label: "TA",            description: "Technical Architect — view and contribute to technical stages" },
  { key: "viewer",      label: "Viewer",        description: "Read-only access" },
];

// ─── Job functions ──────────────────────────────────────────────────────────────
export const JOB_FUNCTIONS = ["CSE", "CSM", "COM", "AE", "TA", "Solutions", "Management", "Other"];

// ─── Regions ───────────────────────────────────────────────────────────────────
export const REGIONS = ["EMEA", "APAC", "AMER", "LATAM", "Global"];

// ─── Customer segments ─────────────────────────────────────────────────────────
export const SEGMENTS = ["Enterprise", "Strategic", "Growth", "SB"];

// ─── Subscription types ────────────────────────────────────────────────────────
export const SUBSCRIPTIONS = ["Enterprise", "Premium", "Standard"];

// ─── Opportunity types ─────────────────────────────────────────────────────────
export const OPP_TYPES = ["New Business", "Expansion", "Renewal", "Migration", "Trial"];

// ─── T-shirt sizes ─────────────────────────────────────────────────────────────
export const TSHIRT_SIZES = ["Small", "Standard", "Large", "Custom"];

// ─── Currencies ────────────────────────────────────────────────────────────────
export const CURRENCIES = ["GBP £", "USD $", "EUR €", "AUD $"];

// ─── Plan types ────────────────────────────────────────────────────────────────
export const PLAN_TYPES = ["Onboarding", "Roadmap"];

// ─── RAG statuses ──────────────────────────────────────────────────────────────
export const RAG_STATUSES = [
  { key: "green", label: "On Track",  emoji: "🟢", colour: "#16A34A", bg: "var(--green-light)"  },
  { key: "amber", label: "At Risk",   emoji: "🟠", colour: "#D97706", bg: "var(--amber-light)"  },
  { key: "red",   label: "Off Track", emoji: "🔴", colour: "#DC2626", bg: "var(--red-light)"    },
];

// ─── SC Modules ────────────────────────────────────────────────────────────────
export const SC_MODULES = [
  "Templates", "Inspections", "Schedules", "Actions", "Issues",
  "Investigations", "Documents", "Sensors", "Telematics", "Assets",
  "Heads Up", "Lone Worker", "Training", "Analytics", "Contractors", "Library",
];

// ─── Integrations ──────────────────────────────────────────────────────────────
export const INTEGRATIONS = [
  "SSO", "SCIM", "Workato", "Power BI", "Tableau", "SharePoint",
  "Microsoft Fabric", "ServiceNow", "Zapier", "Microsoft Teams",
  "SAP Asset Management", "SAP Quality Management", "SAP SuccessFactors",
  "SDS Manager", "SafetyInsights", "GoogleDrive", "OneDrive", "Dropbox",
  "Workday", "EmploymentHero", "Samsara", "Geotab", "Motive by Fleetyr",
  "MS Excel", "Google Sheets", "BambooHR", "Zenoti", "MuleSoft", "Azure Logic Apps",
  "Power Automate", "Make (Integromat)", "Dell Boomi", "SAP BTP / CPI", "REST API",
];

// ─── Task template defaults per stage ─────────────────────────────────────────
export const TASK_TEMPLATES = {
  opportunity: [
    { title: "AE discovery call completed",        owner: "ae",  durationDays: 1, required: true  },
    { title: "Qualifying criteria check",          owner: "ae",  durationDays: 1, required: true  },
    { title: "Pre-sale scoping call (if flagged)", owner: "ta",  durationDays: 3, required: false },
    { title: "CS&I involvement decision",          owner: "admin", durationDays: 1, required: true },
  ],
  requirements: [
    { title: "Kickoff / introductory call",        owner: "ae",  durationDays: 2, required: true  },
    { title: "Requirements scoping session",       owner: "cse", durationDays: 3, required: true  },
    { title: "Integration requirements review",    owner: "ta",  durationDays: 3, required: false },
    { title: "T-shirt size agreed",                owner: "admin", durationDays: 1, required: true },
    { title: "Scope document issued to customer",  owner: "cse", durationDays: 2, required: true  },
    { title: "Customer scope sign-off",            owner: "customer", durationDays: 5, required: true,
      customerNote: "Please review the scope document sent by your SafetyCulture CSE and confirm you're happy to proceed. Reply to your CSE or sign off via email." },
  ],
  "technical-review": [
    { title: "Pre-call technical questionnaire sent", owner: "cse", durationDays: 1, required: true  },
    { title: "Right attendees confirmed",             owner: "cse", durationDays: 1, required: true  },
    { title: "Session 1 — Discovery",                 owner: "cse", durationDays: 3, required: true  },
    { title: "Solution design document",              owner: "cse", durationDays: 5, required: true  },
    { title: "API / integration feasibility (TA)",    owner: "ta",  durationDays: 3, required: false },
    { title: "Internal technical review",             owner: "admin", durationDays: 2, required: true },
    { title: "Solution approval — customer",          owner: "customer", durationDays: 5, required: true,
      customerNote: "Your SafetyCulture team has designed a technical solution for your integration. Please review and confirm approval so build work can begin. Your CSE will walk you through the design on a call." },
  ],
  onboarding: [
    { title: "Kickoff call completed",           owner: "com", durationDays: 1, required: true  },
    { title: "Recap email sent (within 24h)",    owner: "com", durationDays: 1, required: true  },
    { title: "User list received",               owner: "customer", durationDays: 5, required: true,
      customerNote: "Please provide a spreadsheet of all users to be set up in SafetyCulture. Include: full name, email address, job title, and site/location. Use the template your COM has sent, or ask them for one." },
    { title: "Site list received",               owner: "customer", durationDays: 5, required: true,
      customerNote: "Please provide a list of all sites/locations to be configured in SafetyCulture. Include: site name, address, and the primary contact at each site." },
    { title: "Account configuration complete",   owner: "com", durationDays: 3, required: true  },
    { title: "Admin & configuration session",    owner: "com", durationDays: 5, required: true  },
    { title: "Template building sessions",       owner: "com", durationDays: 7, required: true  },
    { title: "End-user training",                owner: "com", durationDays: 5, required: true  },
    { title: "Launch & go-live review",          owner: "com", durationDays: 3, required: true  },
    { title: "Onboarding complete sign-off",     owner: "customer", durationDays: 3, required: true,
      customerNote: "Please confirm that onboarding is complete and your team is set up in SafetyCulture. Your COM will send a short sign-off form — this unlocks the next phase of your engagement." },
  ],
  "solution-delivery": [
    { title: "PoC development",             owner: "cse", durationDays: 10, required: true  },
    { title: "Internal testing (CSE)",      owner: "cse", durationDays: 5,  required: true  },
    { title: "Customer UAT session",        owner: "customer", durationDays: 7, required: true,
      customerNote: "Your integration is ready for user acceptance testing (UAT). Please test the solution in your environment and provide feedback to your CSE. We need: confirmation it works end-to-end, any bugs or issues found, and sign-off when you're satisfied." },
    { title: "Iteration / bug fix cycle",   owner: "cse", durationDays: 5,  required: false },
    { title: "Final testing sign-off",      owner: "cse", durationDays: 2,  required: true  },
    { title: "Handover documentation",      owner: "cse", durationDays: 3,  required: true  },
    { title: "Configuration runbook",       owner: "cse", durationDays: 2,  required: true  },
  ],
  "go-live": [
    { title: "Production deployment",            owner: "cse", durationDays: 1, required: true  },
    { title: "Hypercare support window",         owner: "cse", durationDays: 7, required: true  },
    { title: "CSE → CSM handover call",          owner: "csm", durationDays: 2, required: true  },
    { title: "CSM handover pack reviewed",       owner: "csm", durationDays: 3, required: true  },
    { title: "Customer go-live confirmation",    owner: "customer", durationDays: 2, required: true,
      customerNote: "Your integration is live in production! Please confirm everything is working as expected. Your CSE will send a short confirmation — this formally closes the engagement and hands you over to your CSM." },
    { title: "Engagement closed in Salesforce",  owner: "cse", durationDays: 1, required: true  },
  ],
  "csm-ongoing": [
    { title: "30-day adoption review", owner: "csm", durationDays: 30, required: true  },
    { title: "First QBR",              owner: "csm", durationDays: 60, required: true  },
    { title: "Renewal assessment",     owner: "csm", durationDays: 90, required: false },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function todayIso() { return new Date().toISOString().slice(0, 10); }

export function workingDayAdd(iso, n) {
  let d = new Date(iso), added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d.toISOString().slice(0, 10);
}

export function buildDefaultTasks(stageKey, startDate = todayIso()) {
  const templates = TASK_TEMPLATES[stageKey] || [];
  let cursor = startDate;
  return templates.map((t, i) => {
    const task = {
      id: stageKey + "-" + i + "-" + Date.now(),
      title: t.title,
      ownerRole: t.owner,
      ownerUid: null,
      startDate: cursor,
      endDate: workingDayAdd(cursor, t.durationDays),
      required: t.required,
      done: false,
      notes: "",
    };
    cursor = workingDayAdd(task.endDate, 1);
    return task;
  });
}

export function diffDays(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

export function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function fmtDateTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(ts) {
  if (!ts) return "never";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const m = Math.floor((Date.now() - d) / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

export function stageColour(key) {
  return STAGES.find(s => s.key === key)?.colour || "#64748B";
}

export function ragConfig(key) {
  return RAG_STATUSES.find(r => r.key === key) || RAG_STATUSES[0];
}

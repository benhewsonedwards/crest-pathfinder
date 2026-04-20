// ─── Lifecycle stages ─────────────────────────────────────────────────────────
export const STAGES = [
  { key: "opportunity",       label: "Opportunity",           shortLabel: "Opp",   colour: "#64748B", icon: "💼", description: "Deal in pipeline — Sales discovery, CS&I flagged" },
  { key: "requirements",      label: "Requirements",          shortLabel: "Req",   colour: "#3B82F6", icon: "📋", description: "Scoping sessions — capture integration needs, go-live targets" },
  { key: "technical-review",  label: "Technical Review",      shortLabel: "Tech",  colour: "#8B5CF6", icon: "🔬", description: "CSE solution design, architecture, feasibility" },
  { key: "onboarding",        label: "Onboarding",            shortLabel: "Onb",   colour: "#F97316", icon: "🚀", description: "COM-led platform onboarding — templates, users, training. Onboarding engagements only." },
  { key: "solution-delivery", label: "Solution Delivery",     shortLabel: "Del",   colour: "#6559FF", icon: "⚙️",  description: "CSE integration build, PoC, testing, iteration" },
  { key: "go-live",           label: "Go-Live / Handover",    shortLabel: "Live",  colour: "#16A34A", icon: "🎯", description: "Production deployment, hypercare, CSE → CSM handover" },
  { key: "csm-ongoing",       label: "Ongoing (CSM)",         shortLabel: "CSM",   colour: "#0EA5E9", icon: "📊", description: "CSM-managed ongoing engagement — QBRs, adoption, renewals" },
];
export const STAGE_KEYS = STAGES.map(s => s.key);

// Stages relevant to Enhancement engagements — skip COM onboarding (customer is already live)
export const ENHANCEMENT_STAGE_KEYS = ["opportunity", "requirements", "technical-review", "solution-delivery", "go-live", "csm-ongoing"];

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
export const OPP_TYPES = ["New Business", "Expansion", "Renewal", "Migration", "Trial", "Technical Request"];

// ─── T-shirt sizes ─────────────────────────────────────────────────────────────
export const TSHIRT_SIZES = ["Small", "Standard", "Large", "Custom"];

// ─── Currencies ────────────────────────────────────────────────────────────────
export const CURRENCIES = ["GBP £", "USD $", "EUR €", "AUD $"];

// ─── Plan types ────────────────────────────────────────────────────────────────
export const PLAN_TYPES = ["Onboarding", "Enhancement"];

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
    { title: "IT & technical contacts captured",   owner: "cse", durationDays: 1, required: true  },
    // ^ Framework finding: capturing IdP admin, API token holder, developer contact
    //   was a repeated gap across 92 engagements that caused downstream delays
    { title: "Integration requirements review",    owner: "ta",  durationDays: 3, required: false },
    { title: "T-shirt size agreed",                owner: "cse", durationDays: 1, required: true  },
    { title: "Scope document issued to customer",  owner: "cse", durationDays: 2, required: true  },
    { title: "Customer scope sign-off",            owner: "customer", durationDays: 5, required: true,
      customerNote: "Please review the scope document sent by your SafetyCulture CSE and confirm you're happy to proceed. This includes confirming the integration approach, go-live target date, and the IT contacts who will need to be involved. Reply to your CSE or sign off via email." },
  ],
  "technical-review": [
    // Framework: questionnaire must go out 48h before — prevents first session becoming discovery with no output
    { title: "Technical questionnaire sent (48h before)",  owner: "cse", durationDays: 1, required: true  },
    { title: "Right attendees confirmed",                  owner: "cse", durationDays: 1, required: true  },
    { title: "Session 1 — Technical discovery",            owner: "cse", durationDays: 3, required: true  },
    { title: "Session 2 — Solution design",                owner: "cse", durationDays: 3, required: false },
    { title: "API / integration feasibility review (TA)",  owner: "ta",  durationDays: 3, required: false },
    { title: "Solution design document",                   owner: "cse", durationDays: 5, required: true  },
    { title: "Internal technical review",                  owner: "cse", durationDays: 2, required: true  },
    { title: "Solution approval — customer",               owner: "customer", durationDays: 5, required: true,
      customerNote: "Your SafetyCulture team has designed a technical solution for your integration. Please review and confirm approval so build work can begin. Your CSE will walk you through the design on a call — please ensure your IT contact and integration owner can attend." },
  ],
  onboarding: [
    { title: "Kickoff call completed",           owner: "com", durationDays: 1, required: true  },
    // Recap email is part of kickoff — not a sequential task. Target: within 24h of call.
    { title: "Recap & next steps email sent",    owner: "com", durationDays: 1, required: true  },
    { title: "Stakeholder map confirmed",        owner: "com", durationDays: 1, required: true  },
    // ^ Framework: admin contact, IT contact, frontline manager, executive sponsor
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
    { title: "PoC / initial build",          owner: "cse", durationDays: 10, required: true  },
    { title: "Internal testing (CSE)",       owner: "cse", durationDays: 5,  required: true  },
    { title: "Customer UAT session",         owner: "customer", durationDays: 7, required: true,
      customerNote: "Your integration is ready for user acceptance testing (UAT). Please test the solution in your environment and provide feedback to your CSE. We need: confirmation it works end-to-end, any bugs or issues found, and sign-off when you're satisfied." },
    { title: "Iteration / bug fix cycle",    owner: "cse", durationDays: 5,  required: false },
    { title: "Final testing sign-off",       owner: "cse", durationDays: 2,  required: true  },
    { title: "Handover documentation",       owner: "cse", durationDays: 3,  required: true  },
    // Framework: configuration runbook was the most consistently missing output across 92 engagements
    // IT admin must be able to maintain the integration without calling SafetyCulture
    { title: "Configuration runbook",        owner: "cse", durationDays: 2,  required: true  },
  ],
  "go-live": [
    { title: "Production deployment",           owner: "cse", durationDays: 1, required: true  },
    { title: "Hypercare support window",        owner: "cse", durationDays: 7, required: true  },
    // Framework: support handover briefing is a universal go-live task — CSE is not 24/7 on-call
    { title: "Support handover briefing",       owner: "cse", durationDays: 1, required: true  },
    { title: "CSE → CSM handover call",         owner: "csm", durationDays: 2, required: true  },
    { title: "CSM handover pack reviewed",      owner: "csm", durationDays: 3, required: true  },
    { title: "Customer go-live confirmation",   owner: "customer", durationDays: 2, required: true,
      customerNote: "Your integration is live in production! Please confirm everything is working as expected. Your CSE will send a short confirmation — this formally closes the engagement and hands you over to your CSM for ongoing support." },
    { title: "Engagement closed in Salesforce", owner: "cse", durationDays: 1, required: true  },
  ],
  "csm-ongoing": [
    // Tasks are positioned by offsetDays from stage start — not chained end-to-end
    // 30-day adoption review: due on day 30, open for 2 days
    { title: "30-day adoption review", owner: "csm", offsetDays: 29, durationDays: 2, required: true  },
    // First QBR: due around day 90, open for 5 days
    { title: "First QBR",              owner: "csm", offsetDays: 88, durationDays: 5, required: true  },
    // Renewal assessment: due around day 180, open for 5 days
    { title: "Renewal assessment",     owner: "csm", offsetDays: 178, durationDays: 5, required: false },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function todayIso() { return new Date().toISOString().slice(0, 10); }

export function workingDayAdd(iso, n) {
  if (!iso) return todayIso();
  let d = new Date(iso), added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) added++; }
  return d.toISOString().slice(0, 10);
}

// Return the last endDate in a task array (or null if none)
export function stageEndDate(tasks) {
  const ends = (tasks || []).map(t => t.endDate).filter(Boolean).sort();
  return ends.length > 0 ? ends[ends.length - 1] : null;
}

// ─── Ripple: re-chain tasks so each starts the working day after the previous ends.
// Shifts tasks both FORWARD (delay) and BACKWARD (pull-in when predecessor finishes early).
// Locked tasks are anchors — they don't move, but they still constrain what comes after.
// Done tasks are also anchors.
export function rippleTasks(tasks) {
  if (!tasks || tasks.length === 0) return tasks;
  const out = tasks.map(t => ({ ...t }));
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1];
    if (!prev.endDate) continue;
    if (out[i].done || out[i].locked) continue;  // anchors — don't move

    const idealStart = workingDayAdd(prev.endDate, 1);
    if (out[i].startDate === idealStart) continue; // already correct

    // Preserve duration as raw milliseconds (calendar time) so weekends aren't doubled
    const durMs = (out[i].startDate && out[i].endDate)
      ? new Date(out[i].endDate).getTime() - new Date(out[i].startDate).getTime()
      : 2 * 86400000;

    const newEnd = new Date(new Date(idealStart).getTime() + durMs).toISOString().slice(0, 10);
    out[i] = { ...out[i], startDate: idealStart, endDate: newEnd };
  }
  return out;
}

// ─── Ripple across all stages — handles both forward (delay) and backward (pull-in).
// Locked tasks within a stage act as anchors that stop backward pull past them.
export function rippleAllStages(stageTasks, changedStageKey) {
  const result = {};
  STAGE_KEYS.forEach(sk => { result[sk] = (stageTasks[sk] || []).map(t => ({ ...t })); });

  // Ripple within the changed stage first
  result[changedStageKey] = rippleTasks(result[changedStageKey]);

  // Then propagate stage by stage in both directions from changedStageKey
  const changedIdx = STAGE_KEYS.indexOf(changedStageKey);
  for (let si = Math.max(changedIdx, 0); si < STAGE_KEYS.length - 1; si++) {
    const thisKey = STAGE_KEYS[si];
    const nextKey = STAGE_KEYS[si + 1];
    const thisEnd = stageEndDate(result[thisKey]);
    if (!thisEnd) continue;

    const nextTasks = result[nextKey];
    if (!nextTasks || nextTasks.length === 0) continue;

    // Find the first non-done, non-locked task in the next stage
    const firstMovable = nextTasks.find(t => !t.done && !t.locked);
    if (!firstMovable) continue;

    const idealNextStart = workingDayAdd(thisEnd, 1);
    const currentStart = firstMovable.startDate || idealNextStart;

    if (currentStart === idealNextStart) {
      // Already aligned — still ripple within to handle any internal gaps
      result[nextKey] = rippleTasks(nextTasks);
      continue;
    }

    // Shift the whole stage (non-done, non-locked tasks) by the delta
    const deltaMs = new Date(idealNextStart) - new Date(currentStart);
    const shiftFn = (iso) => {
      if (!iso) return iso;
      const d = new Date(iso);
      d.setTime(d.getTime() + deltaMs);
      // Snap to nearest working day in the direction of travel
      if (deltaMs > 0) {
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
      } else {
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
      }
      return d.toISOString().slice(0, 10);
    };

    result[nextKey] = nextTasks.map(t => (t.done || t.locked) ? t : {
      ...t,
      startDate: shiftFn(t.startDate),
      endDate:   shiftFn(t.endDate),
    });

    // Ripple within the shifted stage
    result[nextKey] = rippleTasks(result[nextKey]);
  }
  return result;
}

export function buildDefaultTasks(stageKey, startDate = todayIso()) {
  const templates = TASK_TEMPLATES[stageKey] || [];
  let cursor = startDate;
  return templates.map((t, i) => {
    // If offsetDays is set, position from stage startDate absolutely (not chained)
    const taskStart = t.offsetDays != null
      ? workingDayAdd(startDate, t.offsetDays)
      : cursor;
    const task = {
      id: stageKey + "-" + i + "-" + Date.now(),
      title: t.title,
      owner: t.owner,
      ownerRole: t.owner,
      ownerUid: null,
      startDate: taskStart,
      endDate: workingDayAdd(taskStart, t.durationDays),
      required: t.required,
      done: false,
      locked: false,
      notes: "",
      ...(t.customerNote ? { customerNote: t.customerNote } : {}),
    };
    // Only advance cursor for chained tasks (no offsetDays)
    if (t.offsetDays == null) {
      cursor = workingDayAdd(task.endDate, 1);
    }
    return task;
  });
}

// Build tasks for ALL stages in sequence, each starting the day after the previous ends.
// Enhancement engagements skip the Onboarding stage (customer is already on the platform).
export function buildAllStageTasks(startDate = todayIso(), planType = "Onboarding") {
  const keys = planType === "Enhancement" ? ENHANCEMENT_STAGE_KEYS : STAGE_KEYS;
  const result = {};
  let cursor = startDate;
  for (const sk of keys) {
    const tasks = buildDefaultTasks(sk, cursor);
    result[sk] = tasks;
    const end = stageEndDate(tasks);
    cursor = end ? workingDayAdd(end, 1) : cursor;
  }
  return result;
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

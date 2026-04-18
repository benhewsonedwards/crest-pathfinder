// ─── CSE Call Prep Knowledge Base ─────────────────────────────────────────────
// Derived from: CSE_TA_Engagement_Framework.docx + Onboarding_Kickoff_Framework.docx
// SafetyCulture Customer Success Engineering | April 2026

// ─── Call type detection ──────────────────────────────────────────────────────
export function detectCallType(taskTitle = "", integrations = [], stageKey = "") {
  const t = taskTitle.toLowerCase();
  if (t.includes("kickoff") || t.includes("kick-off")) return "kickoff";
  if (t.includes("discovery") || t.includes("scoping") || t.includes("requirements")) return "discovery";
  if (t.includes("sso") || t.includes("sign-on")) return "sso";
  if (t.includes("scim") || t.includes("provision")) return "scim";
  if (t.includes("api") || t.includes("integration") || t.includes("data")) return "api";
  if (t.includes("workato") || t.includes("automation") || t.includes("zapier") || t.includes("automat")) return "automation";
  if (t.includes("power bi") || t.includes("tableau") || t.includes("snowflake") || t.includes("report") || t.includes("bi ")) return "bi";
  if (t.includes("technical review") || t.includes("tech review") || t.includes("architecture")) return "technical-review";
  if (t.includes("uat") || t.includes("testing") || t.includes("sign-off") || t.includes("sign off")) return "uat";
  if (t.includes("handover") || t.includes("go-live") || t.includes("go live") || t.includes("launch")) return "go-live";
  if (t.includes("qbr") || t.includes("quarterly")) return "qbr";
  if (t.includes("training")) return "training";
  // Fall back to integrations in scope
  const i = (integrations || []).join(" ").toLowerCase();
  if (i.includes("sso") || i.includes("saml") || i.includes("okta") || i.includes("azure")) return "sso";
  if (i.includes("scim")) return "scim";
  if (i.includes("workato") || i.includes("zapier") || i.includes("make") || i.includes("power automate")) return "automation";
  if (i.includes("power bi") || i.includes("snowflake") || i.includes("tableau")) return "bi";
  if (i.includes("api") || i.includes("rest")) return "api";
  // Fall back to stage
  if (stageKey === "opportunity") return "discovery";
  if (stageKey === "requirements") return "kickoff";
  if (stageKey === "technical-review") return "technical-review";
  if (stageKey === "onboarding") return "onboarding-session";
  if (stageKey === "go-live") return "go-live";
  if (stageKey === "csm-ongoing") return "qbr";
  return "general";
}

// ─── Pre-call checklist (universal) ──────────────────────────────────────────
const UNIVERSAL_CHECKLIST = [
  "Confirm the customer is on the Enterprise plan — SSO, SCIM, and advanced API are Enterprise-only",
  "Review AE or COM handover notes: know what was committed in the sales cycle",
  "Identify the engagement type from the request (SSO, SCIM, API, automation, BI, TA discovery)",
  "Check for any existing technical configurations in the customer's SafetyCulture account",
  "Review prior CSE or TA call notes if this is a returning customer",
  "Confirm the right attendees are booked — business contacts rarely own the IdP or API gateway",
];

// ─── Who should attend by call type ──────────────────────────────────────────
const WHO_SHOULD_ATTEND = {
  kickoff:            ["COM (lead)", "CSM", "Customer project lead / internal champion", "IT contact if integrations are in scope"],
  discovery:          ["CSE", "Customer project lead", "IT contact (if integrations likely)", "AE (optional)"],
  sso:                ["CSE", "Customer IT admin who OWNS the identity provider (Okta, Azure AD, etc.) — not the business stakeholder", "Customer project lead"],
  scim:               ["CSE", "Customer IT admin for the IdP", "HR / People Ops lead who understands user attribute structure"],
  api:                ["CSE", "Customer developer or technical lead who will write integration code", "Person who holds or will hold the API token"],
  automation:         ["CSE", "Customer's Workato/automation platform owner", "Person who manages the downstream system"],
  bi:                 ["CSE", "Customer BI engineer or data analyst who owns the BI environment", "Person who manages the data warehouse if applicable"],
  "technical-review": ["CSE / TA", "Customer enterprise architect or technical lead", "Person who owns the systems being integrated"],
  uat:                ["CSE", "Customer technical lead", "End users or testers from the customer side"],
  "go-live":          ["CSE", "CSM", "Customer project lead", "Customer IT admin for production access"],
  qbr:                ["CSM", "Customer executive sponsor / economic buyer", "Customer admin / champion"],
  training:           ["COM", "Customer admin", "End-user representatives"],
  general:            ["CSE", "Customer project lead"],
  "onboarding-session": ["COM", "Customer admin", "Customer internal champion"],
};

// ─── Data gaps to fill by call type ──────────────────────────────────────────
const DATA_GAPS = {
  kickoff: [
    "Primary use case(s) — what are they deploying SafetyCulture for? (Inspections, incidents, training, contractor management)",
    "Number of users and sites/locations to configure",
    "Integration requirements — does the customer need SSO, SCIM, API, or BI connections?",
    "Go-live date — hard deadline or flexible?",
    "Internal champion — who has the most enthusiasm for SafetyCulture?",
    "Existing processes and forms that SafetyCulture will replace",
  ],
  discovery: [
    "Full integration scope — customers often name one system but have several",
    "Data flow direction — from SafetyCulture, to SafetyCulture, or bidirectional?",
    "Developer / IT contact details — the business stakeholder often has no access to IdP or API gateway",
    "In-house developer availability — do they have someone to write and maintain integration code?",
    "Timeline and go-live deadline",
    "Security and compliance requirements (IP allowlisting, data residency, MFA policy)",
  ],
  sso: [
    "Identity provider name and version (Okta, Azure AD / Entra ID, Google Workspace, Ping, ADFS, OneLogin)",
    "SSO flow type (SP-initiated vs IdP-initiated)",
    "Whether SCIM is also needed — customers frequently conflate SSO with SCIM",
    "User scope — all users on SSO, or a subset? Any service accounts that must stay password-based?",
    "MFA policy at the IdP level",
    "IT admin contact who owns the IdP — this person MUST be on the call",
    "Target go-live date and any security review timeline",
  ],
  scim: [
    "Identity provider (same as SSO or different?)",
    "Which SCIM events trigger provisioning: new hire, role change, termination",
    "Deprovisioning policy — deactivate or delete the SafetyCulture user?",
    "User attributes to sync: email, name, department, title, groups/teams, site assignment",
    "HR / People Ops contact who understands user attribute structure",
    "Whether SSO is also required — often conflated",
  ],
  api: [
    "Complete list of ALL systems to integrate — customers name one but have several",
    "Data flow direction per system (read from SC, write to SC, or bidirectional)",
    "Whether they have an active API token — confirm Enterprise tier",
    "In-house developer availability and experience with REST APIs",
    "API refresh frequency required (real-time webhooks vs scheduled batch)",
    "Target datasets (inspections, actions, issues, users) and required fields",
    "Historical data requirements — how far back?",
    "Security requirements (IP allowlisting, mTLS, data residency)",
  ],
  automation: [
    "Automation platform in use (Workato, Zapier, Make, Power Automate, MuleSoft, custom script)",
    "Licence status — does the customer hold the licence, and who manages it?",
    "Whether SafetyCulture connectors are already installed in their platform",
    "Trigger: what event starts the automation? (inspection completed, action created, etc.)",
    "Action: what happens downstream? (create Jira ticket, update SAP, send Slack alert, sync HRIS)",
    "Who owns the downstream system — often a different person from the call organiser",
  ],
  bi: [
    "BI tool in use (Power BI, Tableau, Looker, Snowflake-native)",
    "Who manages the BI environment — BI engineer or data analyst must be on the call",
    "Required refresh frequency (real-time vs scheduled daily/hourly)",
    "Data access method preference (direct API query, Snowflake data share, scheduled export)",
    "Data volume estimate",
    "Who will build the actual reports — clarify SC configures the connector, customer owns report development",
  ],
  "technical-review": [
    "Complete systems landscape — SAP, Workday, ServiceNow, custom ERP, all of them",
    "Integration platform in use (Workato, MuleSoft, Dell Boomi, Azure Logic Apps, SAP BTP)",
    "Data flow direction and write-back requirements per system",
    "Developer / architect availability and their experience level",
    "Security and compliance constraints (network policies, data residency, audit requirements)",
    "Timeline and any hard deadlines (go-live, regulatory event, contract milestone)",
  ],
  uat: [
    "Test scenarios and acceptance criteria — what does 'working' look like to the customer?",
    "Who are the testers — do they have access to the test environment?",
    "Any known issues or edge cases to validate",
    "Sign-off process — who has authority to approve go-live?",
    "Rollback plan if critical issues are found",
  ],
  "go-live": [
    "Production deployment checklist — all configurations verified in staging?",
    "Customer IT admin available for production access if needed",
    "Hypercare window agreed — how long will CSE remain on standby?",
    "Support handover — does the customer know how to raise a support ticket post-CSE?",
    "Configuration runbook ready to hand to customer IT team",
  ],
  qbr: [
    "Current adoption metrics and utilisation data",
    "Outstanding issues or unresolved items from previous QBR",
    "Expansion opportunities — new use cases, additional sites, new integrations",
    "Renewal timeline and commercial context",
    "Executive sponsor's current priorities and how SC aligns",
  ],
  general: [
    "Confirm engagement type and what the customer is expecting from this call",
    "Check for any outstanding action items from previous sessions",
    "Confirm right attendees are present",
  ],
};

// ─── Talking points by call type ─────────────────────────────────────────────
const TALKING_POINTS = {
  kickoff: [
    "Introductions: your name, role, and how long you've been with SafetyCulture",
    "Who else from SafetyCulture is on the call and their role",
    "Clarify what SafetyCulture provides vs what the customer is responsible for — set expectations early",
    "Walk through the onboarding timeline and milestone overview",
    "Use MVP framing to prevent scope creep — what does 'minimum viable product' look like?",
    "Capture primary use cases: inspections, incidents, training, contractor management, lone worker, etc.",
    "Ask: 'What problem did you buy SafetyCulture to solve?' — this gets to the core quickly",
    "Flag any integration requirements immediately and initiate a separate IT kickoff booking",
    "Confirm user list and site list homework templates are sent with a clear deadline",
    "Record the session — customers value being able to replay it post-call",
  ],
  discovery: [
    "Set the agenda clearly at the start — this is a discovery call, not a demo",
    "Map the full technical landscape: systems, data flows, owners, integration points",
    "Agree scope at the end of this session — produce a scope summary document",
    "Surface blockers early: missing IdP admin, no API token, no developer on call",
    "Use the CSE/TA framework question bank to ensure nothing is missed",
    "Do not commit to build timelines until scope is fully understood",
    "Flag if the customer needs a TA engagement for architecture-level work",
  ],
  sso: [
    "Start by confirming which IdP they use — this determines ALL setup steps",
    "Proactively clarify the difference between SSO and SCIM — customers frequently conflate them",
    "Confirm the IT admin who owns the IdP is on this call — reschedule if not present",
    "Set expectation that you will need IdP metadata before configuration can begin",
    "Walk through the two-session structure: Session 1 Discovery → Session 2 Configuration",
    "Address the MFA question proactively — SafetyCulture does not enforce its own MFA in SSO flow",
    "Confirm the go-live timeline and any security review windows that may delay progress",
  ],
  scim: [
    "Explain that SCIM is IdP-driven — provisioning events originate from the identity provider, not SafetyCulture",
    "Confirm whether SSO is also required — often both are needed but only SCIM was requested",
    "Map required user attributes: email, name, department, title, groups, site assignment",
    "Agree deprovisioning policy upfront — deactivate vs delete has operational implications",
    "Confirm which IdP events trigger provisioning: new hire, role change, termination",
    "HR / People Ops must be on this call to confirm attribute structure and deprovisioning policy",
  ],
  api: [
    "Map the FULL data flow before writing a single line of code — this is the most common failure point",
    "Get the complete system inventory in session 1 — customers name one system but always have more",
    "Confirm data flow direction per system (read from SC, write to SC, bidirectional)",
    "Confirm they have an active API token with correct permissions",
    "Address write-back requirements explicitly — this is a separate, more complex flow discovered late",
    "Set expectation on what SafetyCulture delivers vs what the customer's developer builds",
    "Reference: API base URL is https://api.safetyculture.io | Docs: https://developer.safetyculture.com",
  ],
  automation: [
    "Confirm which automation platform they use before booking a workshop — Workato licence issues are the most common blocker",
    "Verify SafetyCulture connectors are already installed, or plan installation time",
    "Define the trigger (inspection completed, action created) AND the downstream action before the session",
    "Identify who owns the downstream system — often a different person from the call organiser",
    "Common Workato triggers: audit.completed, action.created, action.resolved, issue.raised",
    "SafetyCulture has native connectors for: Workato, Zapier, Make, Power Automate (custom connector)",
  ],
  bi: [
    "Clarify that CSE configures the data connector — building the actual reports is the customer's responsibility",
    "Confirm BI tool and version — Power BI, Tableau, Looker, and Snowflake all have different setup paths",
    "Agree data access method: direct API query, Snowflake data share, or scheduled export",
    "Capture required refresh frequency upfront — this determines the architecture",
    "BI engineer or data analyst must be on this call — business stakeholders cannot complete the setup",
    "SafetyCulture offers Safety Insights, live Power BI connections, and Snowflake data shares",
  ],
  "technical-review": [
    "This is architecture-level discovery — do not commit to solutions in session 1",
    "Map the complete systems landscape: SAP, Workday, ServiceNow, custom ERP, all integration points",
    "Identify existing integration platform (Workato, MuleSoft, Dell Boomi, SAP BTP) — this changes the architecture significantly",
    "Agree scope formally at the end — produce a scope summary or solution design document",
    "Flag if this should be a TA engagement: SAP/ERP integration, complex multi-system architecture, 100k+ AUD opportunity",
    "Do not overpromise — no custom API development, no roadmap items, no known problematic integrations",
  ],
  uat: [
    "Confirm test scenarios and what 'passed' looks like before starting",
    "End-to-end test with real users and real data — not synthetic test data",
    "Validate deprovisioning (SCIM) if applicable",
    "Check API rate limits and BI refresh performance under expected load",
    "Agree sign-off process — who has authority to approve go-live?",
    "Document any issues found and agree a fix timeline before closing the session",
  ],
  "go-live": [
    "Production deployment checklist — confirm all configurations verified",
    "Set the hypercare window upfront: how long will CSE remain on standby post go-live?",
    "Hand over the configuration runbook to the customer IT contact — this is a critical step that is often skipped",
    "Introduce the support ticket process — CSE is not 24/7 on-call after handover",
    "CSE → CSM handover: confirm CSM has the account context before closing the CSE engagement",
    "Get customer go-live confirmation in writing (email or Gong-recorded call)",
  ],
  qbr: [
    "Review progress against previously agreed objectives and KPIs",
    "Present adoption and utilisation data — use Hex dashboards if available",
    "Identify expansion opportunities: new use cases, additional sites, new integrations",
    "Address any outstanding issues or risks to the relationship",
    "Align on next quarter's objectives and success metrics",
    "Confirm renewal timeline if approaching contract end",
  ],
  training: [
    "Confirm who is being trained and at what level (admin vs end user)",
    "Clarify what SafetyCulture delivers vs what the customer is responsible for post-training",
    "Digitise up to 5 priority templates — customer owns ongoing template creation post-onboarding",
    "Record the session and share post-call — highly valued by customers",
    "Set clear homework and next steps with deadlines",
  ],
  general: [
    "Set a clear agenda at the start of the call",
    "Confirm the right attendees are present for the topics to be covered",
    "Use SPICED framework: Situation, Pain, Impact, Critical Event, Decision",
    "Leave with documented next steps and owners assigned",
    "Record the session if possible",
  ],
  "onboarding-session": [
    "Review account configuration completed so far",
    "Walk through template building progress",
    "Address any blockers: missing user list, site list not confirmed, integration questions",
    "Confirm training session schedule and who needs to attend",
    "Set clear go-live date and work backwards from it",
  ],
};

// ─── Critical questions by call type ─────────────────────────────────────────
const CRITICAL_QUESTIONS = {
  kickoff: [
    "What problem did you buy SafetyCulture to solve?",
    "What are your primary use cases — inspections, incidents, training, contractor management?",
    "How many users and how many sites/locations do you need to configure?",
    "Do you need to connect SafetyCulture to any other systems (SSO, SCIM, API, BI)?",
    "Is there a hard go-live date, and are there any upcoming audits or regulatory events we need to meet?",
    "Who is your internal champion — the person most enthusiastic about SafetyCulture?",
    "What processes or forms currently exist that SafetyCulture will replace?",
  ],
  discovery: [
    "What is the complete list of systems you need to connect to SafetyCulture?",
    "For each system: is the data flow from SafetyCulture, to SafetyCulture, or bidirectional?",
    "Who at your end owns the identity provider (IdP) or API gateway?",
    "Do you have an in-house developer who can build and maintain integration code?",
    "What is your target go-live date?",
    "Are there any security or compliance requirements we should know about?",
  ],
  sso: [
    "Which identity provider do you use for SSO? (Okta, Azure AD / Entra ID, Google Workspace, Ping, ADFS, other)",
    "Is the IT admin who owns the identity provider on this call?",
    "Do you also need SCIM for automated user provisioning, or just SSO?",
    "Will all users use SSO, or just a subset? Any service accounts that must stay password-based?",
    "Is MFA enforced at the IdP level?",
    "What is your target go-live date, and is there a security review process we need to factor in?",
  ],
  scim: [
    "Which identity provider are you using for SCIM provisioning?",
    "Do you also need SSO configured, or is SCIM standalone?",
    "Which events trigger provisioning — new hire, role change, termination?",
    "What is your deprovisioning policy — deactivate or delete the user in SafetyCulture?",
    "What user attributes need to sync? (email, name, department, title, groups, site assignment)",
    "Is the HR / People Ops contact who understands user attribute structure on this call?",
  ],
  api: [
    "What is the complete list of ALL systems you want to connect to SafetyCulture?",
    "For each: is the data flow read from SafetyCulture, write to SafetyCulture, or bidirectional?",
    "Do you have an active SafetyCulture API token, or do we need to create one?",
    "Do you have an in-house developer to write and maintain the integration code?",
    "What data do you need — inspections, actions, issues, users? How far back historically?",
    "What refresh frequency do you need — real-time webhooks or scheduled batch?",
  ],
  automation: [
    "Which automation platform do you use — Workato, Zapier, Make, Power Automate, or something else?",
    "Do you hold the licence for that platform, and who manages it?",
    "Are SafetyCulture connectors already installed in your platform?",
    "What event should trigger the automation? (inspection completed, action created, etc.)",
    "What should happen downstream — create a ticket in Jira, update SAP, send a Slack alert?",
    "Who owns the downstream system — are they on this call?",
  ],
  bi: [
    "Which BI tool do you use — Power BI, Tableau, Looker, Snowflake?",
    "Is the BI engineer or data analyst who manages your BI environment on this call?",
    "How often do you need the data refreshed — real-time, hourly, or daily?",
    "Do you have Snowflake already, or would you use direct API or scheduled export?",
    "Who will build the actual reports — clarify that SC configures the connector, not the reports themselves",
  ],
  "technical-review": [
    "What is the complete list of systems in scope — including SAP, Workday, ServiceNow, custom ERP?",
    "Do you have an existing integration platform (Workato, MuleSoft, Dell Boomi, SAP BTP)?",
    "What is the data flow direction per system?",
    "Is the enterprise architect or technical lead who owns these systems on this call?",
    "Are there security, compliance, or data residency requirements we need to design around?",
    "What is the timeline, and are there any hard deadlines?",
  ],
  uat: [
    "What are the test scenarios — what does 'working' look like to you?",
    "Who are the testers, and do they have access to the test environment?",
    "What is the sign-off process — who has authority to approve go-live?",
    "If we find critical issues today, what is the timeline for resolution before go-live?",
  ],
  "go-live": [
    "Is everything verified in the staging/pre-production environment?",
    "How long do you need hypercare support post go-live?",
    "Does your IT team have the configuration runbook?",
    "Do you know how to raise a support ticket if something goes wrong after handover?",
  ],
  qbr: [
    "How are you tracking against the goals you set at the start of the engagement?",
    "What is working well, and what could be improved?",
    "Are there other teams or departments that could benefit from SafetyCulture?",
    "Are there any risks to renewal that we should address?",
  ],
  general: [
    "What is the primary objective of this call?",
    "What does success look like for you at the end of this session?",
    "Are there any blockers or concerns we should address first?",
  ],
  "onboarding-session": [
    "Have you received and completed the user list and site list templates?",
    "What are your top 5 priority templates to digitise first?",
    "Who will be attending end-user training?",
    "Are there any integration requirements we haven't discussed yet?",
  ],
  training: [
    "Who is being trained today — admins, end users, or both?",
    "What are the top 3 workflows you most need to understand by end of this session?",
    "Are there any processes currently done on paper that we should digitise together today?",
  ],
};

// ─── SC Documentation by call type ───────────────────────────────────────────
const SC_DOCS = {
  sso: [
    { title: "SSO Setup Guide", url: "https://help.safetyculture.com/en-US/000017/", relevance: "Step-by-step SSO configuration for all supported identity providers" },
    { title: "SafetyCulture API Documentation", url: "https://developer.safetyculture.com", relevance: "API reference including authentication setup" },
    { title: "Supported IdPs: Okta, Azure AD, Google, Ping, ADFS, OneLogin, JumpCloud", url: null, relevance: "All support SAML 2.0; SCIM support varies by IdP — confirm before committing" },
  ],
  scim: [
    { title: "User Provisioning (SCIM) Guide", url: "https://help.safetyculture.com/en-US/000017/", relevance: "SCIM 2.0 setup for automated user provisioning and deprovisioning" },
    { title: "Okta SCIM setup", url: null, relevance: "Native SafetyCulture app in Okta catalogue — SCIM 2.0 via Okta lifecycle management" },
    { title: "Azure AD SCIM setup", url: null, relevance: "SCIM 2.0 provisioning connector available for Entra ID" },
  ],
  api: [
    { title: "SafetyCulture Developer Documentation", url: "https://developer.safetyculture.com", relevance: "Full REST API reference — base URL: https://api.safetyculture.io" },
    { title: "Key endpoints", url: "https://developer.safetyculture.com", relevance: "/audits/search (inspections), /actions/v1/actions, /issues/v1/issues, /users/v1/users" },
    { title: "Webhook events", url: "https://developer.safetyculture.com", relevance: "audit.completed, action.created, action.resolved, issue.raised — for real-time integrations" },
    { title: "Integrations Help Centre", url: "https://help.safetyculture.com/en-US/000077/", relevance: "Overview of all integration options including Zapier, Power Automate, calendar sync, SSO" },
  ],
  automation: [
    { title: "Workato native SafetyCulture connector", url: null, relevance: "Most commonly used — supports triggers (audit completed, action created) and actions (create action, create inspection)" },
    { title: "Zapier SafetyCulture integration", url: "https://zapier.com/apps/safetyculture/integrations", relevance: "Native Zap triggers — limited to simpler workflows, no write-back to SC" },
    { title: "Make (Integromat) SafetyCulture module", url: null, relevance: "Good for medium-complexity workflows; bidirectional supported" },
    { title: "Power Automate custom connector", url: null, relevance: "Common in Microsoft-heavy environments; requires Azure AD for auth" },
    { title: "SafetyCulture API Documentation", url: "https://developer.safetyculture.com", relevance: "API reference for building custom automation logic" },
  ],
  bi: [
    { title: "Safety Insights", url: "https://help.safetyculture.com", relevance: "SafetyCulture's native analytics tool — configurable dashboards and reports" },
    { title: "Power BI integration", url: "https://help.safetyculture.com/en-US/004668/", relevance: "Live Power BI connection — configure data connector, customer builds reports" },
    { title: "Snowflake data share", url: "https://developer.safetyculture.com", relevance: "For customers with Snowflake — scheduled data share, no API coding required" },
    { title: "SafetyCulture API — data feed endpoints", url: "https://developer.safetyculture.com", relevance: "Use /audits/search, /actions, /issues for custom data pipelines" },
  ],
  general: [
    { title: "SafetyCulture Help Centre", url: "https://help.safetyculture.com", relevance: "Full customer-facing documentation" },
    { title: "SafetyCulture Developer Documentation", url: "https://developer.safetyculture.com", relevance: "API reference and integration guides" },
    { title: "SafetyCulture Integrations Overview", url: "https://help.safetyculture.com/en-US/000077/", relevance: "All integration options including SSO, SCIM, API, Zapier, Power Automate, calendar sync" },
  ],
};
SC_DOCS.kickoff = SC_DOCS.general;
SC_DOCS.discovery = SC_DOCS.general;
SC_DOCS["technical-review"] = [...SC_DOCS.api, ...SC_DOCS.automation];
SC_DOCS.uat = SC_DOCS.general;
SC_DOCS["go-live"] = SC_DOCS.general;
SC_DOCS.qbr = SC_DOCS.general;
SC_DOCS.training = SC_DOCS.general;
SC_DOCS["onboarding-session"] = SC_DOCS.general;

// ─── Stage-based context ──────────────────────────────────────────────────────
const STAGE_CONTEXT = {
  opportunity:        "This is an early-stage engagement — focus on qualifying the opportunity and understanding the customer's technical landscape before committing to scope.",
  requirements:       "Requirements gathering stage — your goal is to capture the full technical scope. Leave session 1 with a documented scope summary. Do not begin build work.",
  "technical-review": "Technical review stage — solution design and feasibility. Do not commit to timelines or custom development. Produce a solution design document by end of this stage.",
  onboarding:         "COM-led onboarding stage — focused on platform setup, template building, user configuration, and end-user training. Flag any integration requirements immediately.",
  "solution-delivery":"Active build stage — CSE is implementing the agreed solution. Any scope changes must be formally agreed before work begins.",
  "go-live":          "Go-live and handover stage — production deployment, hypercare, and CSE → CSM handover. Ensure configuration runbook is ready to hand over.",
  "csm-ongoing":      "Ongoing CSM engagement — focus on adoption, value realisation, expansion, and renewal. Leverage QBR structure.",
};

// ─── Integration-specific notes ──────────────────────────────────────────────
const INTEGRATION_NOTES = {
  "SSO":              "Enterprise-only. Confirm IdP name (Okta, Azure AD, Google, Ping, ADFS) and that the IT admin who owns the IdP is on the call.",
  "SCIM":             "Often conflated with SSO — confirm whether both are needed. SCIM is IdP-driven; provisioning events originate from the IdP, not SafetyCulture.",
  "Workato":          "Most commonly used automation platform. Confirm licence status and whether SC connectors are installed before booking a workshop.",
  "Power BI":         "CSE configures the data connector. Customer's BI engineer builds the reports. Confirm refresh frequency and BI tool ownership.",
  "Snowflake":        "Scheduled data share available. Confirm data volume and refresh cadence requirements.",
  "REST API":         "Enterprise plan required for full API access. Confirm API token exists and developer is available to write integration code.",
  "Microsoft Teams":  "Notification/alert integrations typically via Power Automate or Workato. Confirm use case before scoping.",
  "SharePoint":       "Document storage integration — typically via Power Automate. Confirm what should be exported and trigger events.",
  "ServiceNow":       "Common ITSM integration for action → incident creation. Confirm ServiceNow instance access and which SC events should trigger.",
  "SAP Asset Management": "Complex SAP integration — TA engagement recommended. Confirm SAP version, modules in scope, and whether they have Workato/MuleSoft/SAP BTP.",
  "Workday":          "HRIS user provisioning use case — map job change events to SC user creation/deactivation. Confirm Workday API access and SCIM compatibility.",
};

// ─── Main function: generate call prep from engagement data ───────────────────
export function generateCallPrep(taskTitle, stageKey, engagement = {}) {
  const { integrations = [], modules = [], notes = "", customer = "", planType = "Onboarding", oppType = "" } = engagement;

  const callType = detectCallType(taskTitle, integrations, stageKey);
  const stageContext = STAGE_CONTEXT[stageKey] || "";

  // Build customer context from available engagement data
  const contextParts = [];
  if (customer) contextParts.push(`Customer: ${customer}`);
  if (planType) contextParts.push(planType === "Enhancement" ? "Existing customer — enhancement / technical request" : "New onboarding customer");
  if (oppType) contextParts.push(`Opportunity type: ${oppType}`);
  if (modules?.length) contextParts.push(`Modules in scope: ${modules.join(", ")}`);
  if (integrations?.length) contextParts.push(`Integrations: ${integrations.join(", ")}`);
  if (notes) contextParts.push(`Notes: ${notes}`);
  if (stageContext) contextParts.push(stageContext);

  // Integration-specific notes
  const integrationNotes = (integrations || [])
    .filter(i => INTEGRATION_NOTES[i])
    .map(i => ({ topic: i, detail: INTEGRATION_NOTES[i] }));

  // Build SC docs — merge call-type docs with any integration-specific docs
  const docsForCallType = SC_DOCS[callType] || SC_DOCS.general;
  const extraDocs = [];
  if (integrations.some(i => ["SSO", "SCIM"].includes(i))) extraDocs.push(...(SC_DOCS.sso || []));
  if (integrations.some(i => i.toLowerCase().includes("workato") || i.toLowerCase().includes("zapier") || i.toLowerCase().includes("make") || i.toLowerCase().includes("power automate"))) extraDocs.push(...(SC_DOCS.automation || []));
  if (integrations.some(i => ["REST API"].includes(i))) extraDocs.push(...(SC_DOCS.api || []));
  if (integrations.some(i => ["Power BI", "Snowflake", "Tableau"].includes(i))) extraDocs.push(...(SC_DOCS.bi || []));
  // Deduplicate docs by title
  const allDocs = [...docsForCallType];
  extraDocs.forEach(d => { if (!allDocs.find(x => x.title === d.title)) allDocs.push(d); });

  return {
    callType,
    talkingPoints: TALKING_POINTS[callType] || TALKING_POINTS.general,
    criticalQuestions: CRITICAL_QUESTIONS[callType] || CRITICAL_QUESTIONS.general,
    customerMentioned: integrationNotes,
    customerContext: contextParts.join(" · ") || `${customer || "Customer"} — ${callType} call at ${stageKey} stage.`,
    scDocs: allDocs.slice(0, 5),
    nextSteps: DATA_GAPS[callType]?.slice(0, 4) || [],
    dataGapsToFill: DATA_GAPS[callType] || DATA_GAPS.general,
    whoShouldAttend: WHO_SHOULD_ATTEND[callType] || WHO_SHOULD_ATTEND.general,
    preCallChecklist: UNIVERSAL_CHECKLIST,
    sourceConfidence: integrations?.length || modules?.length || notes ? "medium" : "low",
    sourceSummary: integrations?.length || notes
      ? `Brief generated from engagement data (${[integrations?.length && `${integrations.length} integrations`, modules?.length && `${modules.length} modules`, notes && "notes"].filter(Boolean).join(", ")}) + CSE/TA framework`
      : "Brief generated from CSE/TA Engagement Framework defaults — no customer-specific data captured yet in this engagement",
  };
}

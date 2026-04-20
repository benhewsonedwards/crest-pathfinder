# CREST Pathfinder — Architecture & PRD
_Product Reference Document · Last updated 20 April 2026_

---

## What is CREST?

CREST Pathfinder is a customer lifecycle management tool for the SafetyCulture CS&I (Customer Success & Integrations) EMEA team. It tracks engagements from initial opportunity through to ongoing CSM relationship, providing visibility across the AE, CSE, COM, CSM, and TA functions.

It is a React/Vite SPA authenticated via Google OAuth (SafetyCulture accounts only), backed by Firestore, and deployed to Vercel.

---

## Top-level data model

```
Firestore
│
├── /users/{uid}                    ← Profile, role, display name
│
├── /customers/{customerId}         ← Master customer record
│   ├── .renewalDate / renewalARR / renewalStatus
│   ├── .stakeholders[]             ← Array of stakeholder objects
│   ├── .expansionSignals[]         ← Array of expansion signal objects
│   ├── /activity/{id}              ← Manual commentary (team-written)
│   ├── /audit/{id}                 ← System audit trail (auto-written)
│   └── /successPlan/{snapshotId}   ← QBR snapshots
│
├── /engagements/{engagementId}     ← Single customer engagement
│   ├── .customerId                 ← FK to /customers
│   ├── .currentStage               ← One of 7 stage keys
│   ├── .stageTasks.{stageKey}[]    ← Tasks per stage
│   ├── .captureData.{stageKey}     ← Data capture form answers
│   ├── .successPlan                ← (legacy — moved to customer level)
│   └── /activity/{id}             ← Engagement-level comments
│
├── /integrations/{integrationId}   ← Integration record (linked to customer)
│   └── .tickets[]                  ← Support tickets inline
│
├── /teams/{teamId}                 ← Team structure (unused — see people.js)
│
└── /shareLinks/{tokenId}           ← Customer-facing share links
```

---

## Pages and what they do

### My Dashboard (`/dashboard`)
**Owner:** Individual user (always personal scope)
- 4 stat cards: My open tasks, Overdue, Due this week, Upcoming calls
- Month/week calendar — tasks assigned to logged-in user across all engagements
- Task list with filters: My tasks / All / Overdue / Next 2 weeks / Calls
- `isMyTask()` matches on: ownerUid → ownerEmail → role+engagement.cseEmail → name+cseAssigneeName

### Pipeline (`/pipeline`)
Two views via tab toggle:

**Pipeline tab:**
- Stage funnel (visual bar chart by stage)
- Filterable table: stage, RAG, free text search, person filter
- Click row → Engagement Detail
- "+ New engagement" → Engagement Modal

**Renewals tab:**
- Reads from `/customers` (not engagements)
- Bucketed into 3 quarters (This quarter / Next / Q+2)
- Colour coded: red / amber / green by proximity
- Click row → Customer Dashboard

### Customers (`/customers`)
- Searchable list of all customer records
- Click → Customer Dashboard
- "+ New customer" → Customer Modal
- After creating a customer: prompt to create first engagement

### Customer Dashboard (`/customers/:id`)
Seven tabs:

| Tab | Contents |
|-----|----------|
| Overview | Account details, account team, renewal card, expansion signals, integration portfolio, latest engagement stage progress |
| Stakeholders | Stakeholder map grouped by tier (Executive / Operational / Procurement / Technical) — add/edit/remove |
| Success Plan | Versioned QBR snapshots — objectives, metrics, milestones, health, CSM notes |
| Integrations | All integrations for this customer — click to expand/edit |
| Request history | All support tickets across all integrations |
| Engagements | All engagements linked to this customer |
| Commentary | Unified feed: account-level notes + engagement comments + task notes. Timeline and By Engagement views. Tag/role filters. Composer at top. |
| Activity log | Auto-written audit trail — field changes, stage advances, record creation |

### Engagement Detail (`/engagements/:id`)
Five tabs:

| Tab | Contents |
|-----|----------|
| Overview | Deal details, team assignments, renewal context (from parent customer), task progress, solution scope, data capture completeness, capture form |
| Tasks | Task grid per stage — add/edit/delete/complete tasks, notes panel per task |
| Gantt | SVG Gantt chart — drag to reschedule, drag edges to resize, lock dates |
| Comments | Rich comment composer (tag/role/external flag), comment feed for this engagement |
| _(Data capture)_ | CapturePanel renders inside Overview tab, collapsible per stage |

### Integrations (`/integrations`)
- All integrations across all customers, grouped by category
- Search and filter
- Expand row → linked engagement + task documents
- Click customer → Customer Dashboard

### Issues (`/issues`)
- Flags tickets needing attention: Off track (RAG red), At risk (RAG amber), No update 3+ weeks, Stale active, Waiting on customer, Not started
- Grouped by issue type, collapsible
- Shows CSE first name from People directory

### Team (`/team`)
- Org chart grouped by team (CSM, CS&I, Commercial)
- Manager hierarchy visible
- Sign-in status badge (green dot if active Firebase user)
- "Pipeline" button per person → navigates to Pipeline filtered by that person

### Share Links (`/sharelinks`)
- Manage customer-facing share links
- Create link per customer
- Inline label editing
- Deactivate / reactivate
- Access count and last accessed tracking

### Share Page (`/s/:token`)
- Public-facing, no login required
- Token-based access control
- Shows: engagement progress bar, customer-owned tasks (mark done, add notes), integration summary
- Customer can upload files (requires Blaze plan — placeholder until then)

### Settings
- Platform info
- Security status
- Roadmap

---

## Components

### EngagementModal
Creates or edits an engagement. Four tabs:
- **Core details:** Customer link, CS ID, SF Opp ID, region, segment, subscription, ARR, target ARR, close date, RAG status, notes
- **Team:** AE, CSE, CSM, TA (all from PersonSelect → people.js directory)
- **Solution scope:** SC modules (multi-select), integrations (multi-select), plan type (Onboarding / Enhancement)
- **SF / Jira:** SF Opp link, Jira key/link
- Writes audit entry to parent customer on save (if customerId is set)

### CapturePanel
Per-stage structured data capture. One schema per stage defined in `CAPTURE_SCHEMAS`. Field types: text, textarea, select, multiselect, yesno, yesnodate, date. Conditional sections (showIf). Completeness score. Collapsible sections.

### IntegrationModal
Full integration record. Six tabs: Overview, Technical, Tickets, Data, Documents, History.

### PersonSelect
Searchable dropdown backed by `people.js` EMEA directory (22 people). Filters by role (ae/csm/cse/com/ta/all).

### Sidebar
Navigation. Items: My Dashboard, Customers, Pipeline, Integrations, Issues, Team, Share Links, Settings.

### UI.jsx (shared components)
Btn, Card, CardHeader, Label, Pill, Avatar, Input, Select, Textarea, Modal, Tabs, EmptyState, Spinner, FieldGroup, useToast, ToastContainer, useSortable, SortableHeader, **CommentEntry, CommentTagPill, CommentRolePill, COMMENT_TAGS, STAGE_LABELS, ROLE_COLOURS** (comment system shared components)

---

## Auth and roles

Google OAuth, restricted to `hd: "safetyculture.io"`.

| Role | Access |
|------|--------|
| super_admin | Full access including delete |
| admin | Full access including delete |
| cse | Read/write engagements, integrations, customers |
| csm | Read/write engagements, integrations, customers |
| com | Read/write engagements, integrations, customers |
| ae | Read/write (same as above — no restriction yet) |
| ta | Read/write |
| viewer | Read only |

Role stored in `/users/{uid}.role` — set manually in Firestore console after first sign-in. Ben Edwards is `super_admin`.

---

## People directory (people.js)

22-person EMEA org. Each person has: name, email, initials, roleKey, team, location.

Teams: CS&I (Ben, Léo, JF + Edwin as manager), CSM EMEA, Commercial EMEA (AEs, COMs, TAs).

`taskAssigneesForStage(stageKey)` — returns the right people to show in task owner dropdowns per stage.

---

## 7 Lifecycle stages

| Key | Label | Primary owner | Description |
|-----|-------|---------------|-------------|
| opportunity | Opportunity | AE + CSE | Deal in pipeline |
| requirements | Requirements | CSE | Scoping sessions |
| technical-review | Technical Review | CSE | Solution design |
| onboarding | Onboarding | COM | Platform onboarding (Onboarding plan type only) |
| solution-delivery | Solution Delivery | CSE | Integration build |
| go-live | Go-Live / Handover | CSE → CSM | Production + handover |
| csm | Ongoing (CSM) | CSM | Post-handover relationship |

Enhancement plan type skips Onboarding stage.

---

## Task system

Tasks live in `engagement.stageTasks.{stageKey}[]`. Each task:
```js
{
  id, title,
  owner,         // role key string (legacy) 
  ownerRole,     // role key string
  ownerEmail,    // explicit email (preferred — set on new tasks)
  ownerUid,      // firebase uid
  startDate, endDate,
  required,      // blocks stage advance warning if not done
  done,
  locked,        // date locked (not moved by ripple)
  notes: [],     // [{ text, at, authorName, authorPhoto }]
  files: [],     // file attachments (Blaze plan required)
  customerNotes: [], // notes from customer share view
  customerFiles: [],
}
```

Date rippling: when a task date changes, all subsequent tasks in the stage ripple forward maintaining gaps. `rippleAllStages()` propagates across stage boundaries.

---

## Comment / commentary system

Three source types, all rendering via shared `CommentEntry` component:

| Source | Storage | Written by | Fields |
|--------|---------|-----------|--------|
| `customer` | `customers/{id}/activity` | Team, manual | text, authorName, authorRole, tag, external, _source |
| `engagement` | `engagements/{id}/activity` | Team, manual | + stage, engagementId, engagementName |
| `task` | Inline on task.notes[] | Team, manual | text, at, authorName, authorPhoto |
| `audit` | `customers/{id}/audit` | System, auto | text, authorName, engagementName, _source:"audit" |

**Tags:** Agreed, Escalation, Feedback, Commercial, Risk, Update  
**Role pills:** ae, csm, cse, com, ta, admin, super_admin (colour coded)

Commentary tab merges all three manual sources. Activity log tab shows audit only.

---

## Expansion signals

Stored as `customer.expansionSignals[]` array. Each signal:
```js
{ id, type, description, status, capturedBy, capturedByRole, capturedAt }
```

**Types:** New use case, New team, Seat expansion, Competitor displacement, Upsell opportunity, Executive interest  
**Statuses:** New → Shared with AE → In pipeline → Won / Not pursued

Status changes write to audit log automatically.

---

## Success plan (versioned QBR snapshots)

Stored in `customers/{id}/successPlan/{snapshotId}` subcollection. Each snapshot:
```js
{
  qbrLabel, qbrDate,
  healthStatus, healthReason,
  objectives: [{ id, description, status }],
  metrics:    [{ id, description, current, target }],
  milestones: [{ id, description, targetDate, done }],
  cadence, nextReviewDate, csmNotes,
  createdBy, createdAt, updatedAt, updatedBy
}
```

New snapshot copies from latest — achieved objectives preserved, others reset to Not started.

---

## Stakeholder registry

Stored as `customer.stakeholders[]` array. Each stakeholder:
```js
{ id, name, title, tier, owner, lastContacted, note, addedBy, addedAt }
```

**Tiers:** Executive, Operational, Procurement, Technical, Other  
**Owners:** AE, CSM, CSE, COM

Last contact colour coding: green < 30d, amber 30-60d, red > 60d.

---

## Renewal tracking

Fields on customer record:
- `renewalDate` — ISO date string
- `renewalARR` — number
- `renewalStatus` — on_track / at_risk / needs_attention / not_renewing

Displayed: Customer Overview renewal card, Renewals tab in Pipeline (bucketed into 3 quarters), read-only on Engagement Detail (pulled from parent customer).

**Not yet:** Salesforce sync. Manual entry only.

---

## Share links (customer-facing)

`/shareLinks/{tokenId}` collection. Each link:
```js
{ token, customerId, customerName, label, createdBy, createdAt, active, accessCount, lastAccessedAt }
```

Share page route: `/#/s/:token` — no auth required, token is access control.

---

## Infrastructure

| Component | Detail |
|-----------|--------|
| Frontend | React 18 + Vite, deployed to Vercel via GitHub auto-deploy |
| Database | Firestore (europe-west2) |
| Auth | Firebase Auth, Google OAuth, `hd: safetyculture.io` |
| Storage | Firebase Storage — Blaze plan required, placeholder until then |
| Hosting | Vercel, team `ben-edwards-projects-62ba236d` |
| Repo | `benhewsonedwards/crest-pathfinder` (public) |
| Rules | `firestore.rules` — deploy with `npx firebase-tools deploy --only firestore:rules` |

---

## Key file locations

| File | Purpose |
|------|---------|
| `src/lib/constants.js` | STAGES, TASK_TEMPLATES, date helpers, ripple logic |
| `src/lib/people.js` | 22-person EMEA directory, role helpers |
| `src/components/CapturePanel.jsx` | All data capture schemas + renderer |
| `src/components/EngagementModal.jsx` | Create/edit engagement |
| `src/components/UI.jsx` | All shared UI components incl. comment system |
| `src/pages/CustomerDashboard.jsx` | The largest file — all customer tabs including SuccessPlanTab, StakeholdersTab, ExpansionSignals, CommentaryTab |
| `src/pages/EngagementDetail.jsx` | Full engagement view — tasks, Gantt, comments, capture panel |
| `src/pages/MyDashboard.jsx` | Personal task dashboard — isMyTask() logic here |
| `firestore.rules` | Security rules — must be deployed after changes |

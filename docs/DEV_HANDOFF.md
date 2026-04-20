# CREST Pathfinder — Dev Handoff
_Last updated: 20 April 2026 · Resume: May 2026_

---

## Current state

Live at: https://crest-pathfinder.vercel.app  
Repo: https://github.com/benhewsonedwards/crest-pathfinder  
Firebase project: `crest-io` (europe-west2)  
Vercel team: `ben-edwards-projects-62ba236d`

Enhancements 1–5 of 8 are shipped. Enhancements 6–8 are designed but not built.

---

## Outstanding enhancements (6–8)

### Enhancement 6 — QBR Prep template
**What:** A structured QBR prep checklist on the customer record. Referenced 5–6 times in the Principles of Engagement call as a key AE/CSM collaboration point.

**Where it lives:** New tab on CustomerDashboard — "QBR Prep" — or possibly a sub-section of the Success Plan tab (discuss with Ben).

**What it captures:**
- QBR date and attendees (from Stakeholder registry — link through)
- Value delivered since last QBR (free text + link to engagement milestones)
- Expansion signals to present (pull from Expansion Signals card)
- Renewal status and timeline (pull from Renewal card)
- Open risks / blockers
- Proposed agenda items (ordered list)
- Action items from last QBR (with owner and status)

**Data connections needed:**
- Pre-populate attendees from Stakeholder registry (executive + operational tier)
- Pre-populate expansion signals from `customer.expansionSignals`
- Pre-populate renewal date from `customer.renewalDate`
- Link to Success Plan snapshot for the period

**Storage:** `customers/{id}/qbrPrep` subcollection — one doc per QBR (similar pattern to successPlan)

---

### Enhancement 7 — Opportunity visibility panel
**What:** AEs log active Salesforce opportunities on the customer record so CSMs are never caught out at close/lost. Explicitly flagged as broken in the Principles of Engagement call.

**Where it lives:** Card on Customer Overview tab (below Expansion Signals, above Integration portfolio) OR a dedicated "Pipeline" section — discuss with Ben.

**What it captures:**
- Opportunity name
- Stage (Qualification / Discovery / Proposal / Negotiation / Closed Won / Closed Lost)
- ARR value
- Expected close date
- AE owner (from People directory)
- Brief description / context
- Link to Salesforce opportunity (optional URL field)

**Data connections:**
- Eventually: Salesforce sync (same pattern as renewal — manual until sync)
- Expansion signals of type "upsell_opportunity" or "in_pipeline" could auto-populate here
- Write audit entry when opportunity is added/updated

**Storage:** `customer.opportunities` array (same pattern as `customer.expansionSignals`)

---

### Enhancement 8 — Account Plan
**What:** AE-led, CSM-collaborative strategic account plan. Higher level than the Success Plan — covers commercial strategy, competitive positioning, key exec relationships, and quarterly priorities.

**Where it lives:** New tab on CustomerDashboard — "Account Plan"

**What it captures:**
- Strategic account summary (free text)
- Key priorities this quarter (ordered list with owner AE/CSM)
- Competitive landscape (which competitors are present, risk level)
- Executive relationship map (link to Stakeholder registry exec tier)
- Revenue ambition (target ARR 12/24 months)
- Key risks and mitigations
- AE/CSM alignment notes

**Data connections:**
- Pulls executive stakeholders from Stakeholder registry automatically
- Pulls current ARR and renewal ARR from customer record
- Writes audit entry on save

**Storage:** Single living document `customers/{id}/accountPlan/{docId}` — one per customer, updated in place (not versioned like Success Plan)

---

## Data capture form review (PENDING — Ben to review)

See `DATA_CAPTURE_REVIEW.md` for full breakdown of all capture form fields, questions to review, and proposed data connections to other parts of the tool.

**Key open item:** Primary contact fields in the Requirements stage capture form (`primary_contact`, `primary_contact_email`, `it_contact`, `exec_sponsor`) should auto-populate the Stakeholder registry. This is not yet wired. See DATA_CAPTURE_REVIEW.md for full spec.

---

## Known issues / tech debt

### Firestore rules deployment
Rules are in `firestore.rules` but must be manually deployed after each session:
```bash
cd ~/crest-pathfinder && git pull && npx firebase-tools deploy --only firestore:rules
```
Outstanding rules not yet deployed from this session:
- `customers/{id}/audit` — system audit trail
- `customers/{id}/successPlan` — QBR snapshots

### Vite build cache bug
Vite's incremental build cache has caused stale bundles to deploy at least twice. If a deploy goes live but the app doesn't reflect changes, make a trivial code change to force a new bundle hash before pushing.

### Dashboard task matching
`isMyTask()` in `MyDashboard.jsx` uses three fallback strategies (ownerUid → ownerEmail → role+engagement → name+engagement). Works for current data but will need revisiting if team grows or people change roles — the name-based fallback is fragile.

### File uploads
Placeholder only — requires Firebase Blaze plan for Storage. Rules file written, restore upload logic from git history when upgrading.

### Engagement write rule
`firestore.rules` line ~69: `allow update: if isTeamMember() || true` — the `|| true` allows unauthenticated writes for the customer share view. Must be tightened with a Cloud Function token check on Blaze.

### CapturePanel `csm-ongoing` stage key mismatch
The CapturePanel schema uses `"csm-ongoing"` as the key but the STAGES constant uses `"csm"`. This means the Ongoing/CSM capture form may not render. Verify and align the keys.

---

## Salesforce sync (not yet started)
Fields marked "manual entry until Salesforce sync":
- `customer.renewalDate` / `customer.renewalARR` / `customer.renewalStatus`
- Engagement `sfOppId` and `sfOppLink`

The intended path is a Workato recipe reading from `CSM_Requests__c` and writing to Firestore. Pattern exists in the AC Request Update Drafter tool — same Workato webhook infrastructure.

---

## Architecture reference
See `ARCHITECTURE.md` for the full system diagram and data flow.

## Data capture reference  
See `DATA_CAPTURE_REVIEW.md` for all form fields, review notes, and proposed data connections.

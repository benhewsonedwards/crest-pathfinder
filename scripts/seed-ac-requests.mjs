/**
 * Seed script — acRequests collection
 * Creates 5 realistic EMEA AC request test records in Firestore.
 *
 * Usage:
 *   1. Download service account key from Firebase console → Project Settings → Service accounts
 *   2. Save as scripts/serviceAccount.json (gitignored)
 *   3. node scripts/seed-ac-requests.mjs
 *
 * Safe to re-run — uses sfId as document ID so records are upserted not duplicated.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "fs";

const serviceAccount = JSON.parse(readFileSync("./scripts/serviceAccount.json", "utf8"));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const now = Timestamp.now();
function daysAgo(n) { return Timestamp.fromMillis(Date.now() - n * 86400000); }
function daysFromNow(n) { return Timestamp.fromMillis(Date.now() + n * 86400000); }

const AC_REQUESTS = [
  {
    sfId: "a1BMo000000lPJ7MAM",
    sfName: "AC-16742",
    sfRecordUrl: "https://safetyculture.lightning.force.com/lightning/r/CSM_Requests__c/a1BMo000000lPJ7MAM/view",
    accountName: "Altrad",
    arr: 185000,
    requestType: "Technical",
    sfStatus: "In Progress",
    priority: "High",
    preferredCompletion: daysFromNow(28),
    description: "Integrate with work order system iPlan. Customer wants SC to generate Pre-Job Brief with iPlan Work Order and Operation numbers pre-populated. 60,000 live work orders — GRS approach rejected, exploring API-based dynamic filtering.",
    createdAt: daysAgo(62),
    assignedTo: "Ben Edwards",
    jiraKey: "CSE-1544",
    lastSyncedAt: now,
    // App-managed fields (pre-populated for demo)
    nextMeeting: daysFromNow(4),
    nextDeadline: daysFromNow(28),
    deadlineType: "hard",
    deliverablesSummary: "Dynamic API filter POC via Workato — pending customer sign-off on approach.",
    workEstimate: "high",
    lastUpdatedBy: "ben.edwards@safetyculture.io",
    lastUpdatedAt: daysAgo(2),
    escalationMultiplier: 1.0,
    escalationNote: null,
    escalationSetBy: null,
    escalationSetAt: null,
  },
  {
    sfId: "a1BMo000000mQK2MAM",
    sfName: "AC-16851",
    sfRecordUrl: "https://safetyculture.lightning.force.com/lightning/r/CSM_Requests__c/a1BMo000000mQK2MAM/view",
    accountName: "Network Rail",
    arr: 420000,
    requestType: "Technical",
    sfStatus: "Scoping",
    priority: "Critical",
    preferredCompletion: daysFromNow(14),
    description: "SSO via Azure AD — 12,000 users, phased rollout by region. SCIM provisioning required. Customer has existing Azure tenant with MFA enforced.",
    createdAt: daysAgo(21),
    assignedTo: "Jean-François Pypops",
    jiraKey: "CSE-1632",
    lastSyncedAt: now,
    nextMeeting: daysFromNow(2),
    nextDeadline: daysFromNow(14),
    deadlineType: "hard",
    deliverablesSummary: "SSO config guide + SCIM mapping doc. Kick-off call booked.",
    workEstimate: "high",
    lastUpdatedBy: "jf.pypops@safetyculture.io",
    lastUpdatedAt: daysAgo(1),
    escalationMultiplier: 1.5,
    escalationNote: "Strategic account — board-level visibility at customer.",
    escalationSetBy: "Edwin Davidian",
    escalationSetAt: daysAgo(3),
  },
  {
    sfId: "a1BMo000000nRJ4MAM",
    sfName: "AC-16903",
    sfRecordUrl: "https://safetyculture.lightning.force.com/lightning/r/CSM_Requests__c/a1BMo000000nRJ4MAM/view",
    accountName: "Schneider Electric",
    arr: 310000,
    requestType: "Onboarding",
    sfStatus: "Waiting on Customer",
    priority: "Medium",
    preferredCompletion: daysFromNow(45),
    description: "Platform onboarding for 3 European sites (France, Germany, Poland). Requires localised templates, site hierarchy configuration, and admin training for regional leads.",
    createdAt: daysAgo(18),
    assignedTo: "Léo Furlan",
    jiraKey: "CSE-1680",
    lastSyncedAt: now,
    nextMeeting: null,
    nextDeadline: daysFromNow(45),
    deadlineType: "soft",
    deliverablesSummary: "Waiting for customer to confirm site hierarchy structure before proceeding.",
    workEstimate: "medium",
    lastUpdatedBy: "leo.furlan@safetyculture.io",
    lastUpdatedAt: daysAgo(6),
    escalationMultiplier: 1.0,
    escalationNote: null,
    escalationSetBy: null,
    escalationSetAt: null,
  },
  {
    sfId: "a1BMo000000pSL8MAM",
    sfName: "AC-17012",
    sfRecordUrl: "https://safetyculture.lightning.force.com/lightning/r/CSM_Requests__c/a1BMo000000pSL8MAM/view",
    accountName: "Prysmian Group",
    arr: 95000,
    requestType: "TA Engagement",
    sfStatus: "In Review",
    priority: "Medium",
    preferredCompletion: daysFromNow(60),
    description: "Technical architecture review for Prysmian's global rollout plan. Customer requesting input on data residency, API rate limits, and multi-region org structure.",
    createdAt: daysAgo(9),
    assignedTo: "Ben Edwards",
    jiraKey: "CSE-1514",
    lastSyncedAt: now,
    nextMeeting: daysFromNow(7),
    nextDeadline: null,
    deadlineType: null,
    deliverablesSummary: "Architecture review doc in draft. Awaiting SA input on multi-region guidance.",
    workEstimate: "medium",
    lastUpdatedBy: "ben.edwards@safetyculture.io",
    lastUpdatedAt: daysAgo(3),
    escalationMultiplier: 1.0,
    escalationNote: null,
    escalationSetBy: null,
    escalationSetAt: null,
  },
  {
    sfId: "a1BMo000000qTM5MAM",
    sfName: "AC-17089",
    sfRecordUrl: "https://safetyculture.lightning.force.com/lightning/r/CSM_Requests__c/a1BMo000000qTM5MAM/view",
    accountName: "OVO Energy",
    arr: 68000,
    requestType: "Onboarding",
    sfStatus: "Unplanned",
    priority: "Low",
    preferredCompletion: daysFromNow(90),
    description: "New customer onboarding. Field engineer team of ~200 users. Requires template library setup, initial inspection schedule configuration, and manager dashboard walkthrough.",
    createdAt: daysAgo(4),
    assignedTo: null,
    jiraKey: null,
    lastSyncedAt: now,
    nextMeeting: null,
    nextDeadline: daysFromNow(90),
    deadlineType: "soft",
    deliverablesSummary: null,
    workEstimate: "low",
    lastUpdatedBy: null,
    lastUpdatedAt: null,
    escalationMultiplier: 1.0,
    escalationNote: null,
    escalationSetBy: null,
    escalationSetAt: null,
  },
];

// Milestone sets per request
const MILESTONES = {
  "a1BMo000000lPJ7MAM": [
    { type: "Request opened",   date: daysAgo(62), completed: true,  note: null, isDeadline: false },
    { type: "Kick off meeting", date: daysAgo(55), completed: true,  note: "Discovery complete. API approach agreed in principle.", isDeadline: false },
    { type: "Discovery complete", date: daysAgo(40), completed: true, note: "60k work order volume confirmed. GRS ruled out.", isDeadline: false },
    { type: "POC presented",    date: daysAgo(14), completed: true,  note: "Workato HTTP action POC shown. Customer reviewing.", isDeadline: false },
    { type: "Deadline",         date: daysFromNow(28), completed: false, note: "Customer go-live target", isDeadline: true, deadlineType: "hard" },
    { type: "Solution approved", date: daysFromNow(7), completed: false, note: null, isDeadline: false },
  ],
  "a1BMo000000mQK2MAM": [
    { type: "Request opened",   date: daysAgo(21), completed: true,  note: null, isDeadline: false },
    { type: "Kick off meeting", date: daysAgo(10), completed: true,  note: "Azure AD tenant confirmed. MFA enforced — SCIM required.", isDeadline: false },
    { type: "Deadline",         date: daysFromNow(14), completed: false, note: "Board-level deadline at customer", isDeadline: true, deadlineType: "hard" },
    { type: "Solution approved", date: daysFromNow(5), completed: false, note: null, isDeadline: false },
  ],
  "a1BMo000000nRJ4MAM": [
    { type: "Request opened",   date: daysAgo(18), completed: true,  note: null, isDeadline: false },
    { type: "Kick off meeting", date: daysAgo(12), completed: true,  note: "3 sites confirmed: Paris, Munich, Warsaw.", isDeadline: false },
    { type: "Customer update",  date: daysAgo(6),  completed: true,  note: "Waiting on site hierarchy spreadsheet from customer.", isDeadline: false },
    { type: "Meeting scheduled", date: daysFromNow(12), completed: false, note: "Follow-up once hierarchy confirmed", isDeadline: false },
  ],
  "a1BMo000000pSL8MAM": [
    { type: "Request opened",   date: daysAgo(9), completed: true,  note: null, isDeadline: false },
    { type: "Discovery complete", date: daysAgo(5), completed: true, note: "Multi-region scope confirmed. 4 regions, 2 orgs.", isDeadline: false },
    { type: "Meeting scheduled", date: daysFromNow(7), completed: false, note: "SA review call", isDeadline: false },
  ],
  "a1BMo000000qTM5MAM": [
    { type: "Request opened",   date: daysAgo(4), completed: true,  note: null, isDeadline: false },
  ],
};

async function seed() {
  console.log("Seeding acRequests...");

  for (const req of AC_REQUESTS) {
    const { sfId, ...fields } = req;
    const ref = db.collection("acRequests").doc(sfId);
    await ref.set(fields, { merge: true });
    console.log(`  ✓ ${sfId} — ${req.accountName}`);

    // Seed milestones — delete existing first to prevent duplicates on re-run
    const milestones = MILESTONES[sfId] || [];
    const existingMs = await ref.collection("milestones").get();
    for (const d of existingMs.docs) await d.ref.delete();
    for (const m of milestones) {
      const mRef = ref.collection("milestones").doc();
      await mRef.set({
        ...m,
        createdBy: "seed-script",
        createdAt: now,
      });
    }
    if (milestones.length) console.log(`    └ ${milestones.length} milestones (replaced)`);
  }

  // Seed acrSettings/config if not present
  const settingsRef = db.collection("acrSettings").doc("config");
  const existing = await settingsRef.get();
  if (!existing.exists) {
    await settingsRef.set({
      rankingWeights: {
        arr: 0.30,
        priority: 0.30,
        deadlineProximity: 0.25,
        workEstimate: 0.15,
      },
    });
    console.log("  ✓ acrSettings/config created");
  } else {
    console.log("  ✓ acrSettings/config already exists — skipped");
  }

  console.log("\nDone. 5 AC requests seeded.");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });

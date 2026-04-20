# CREST Pathfinder — Data Capture Review
_All capture form fields across all lifecycle stages. Review each question, note changes, and flag data connections._

---

## How to use this document

For each field, consider:
1. **Is the question right?** Clear, specific, asking for what we actually need?
2. **Is it in the right stage?** Could it be captured earlier or later?
3. **Is it critical?** (Critical = blocks stage completion if empty)
4. **Should it connect elsewhere?** e.g. a stakeholder name entered here should auto-populate the Stakeholder registry

Mark changes with `[CHANGE]`, moves with `[MOVE TO: stage]`, new connections with `[CONNECT TO: destination]`.

---

## Stage 1 — Opportunity (Pre-Engagement Checklist)

### Section: Eligibility
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| enterprise_confirmed | Enterprise plan confirmed | ✅ | |
| ae_handover_reviewed | AE handover notes reviewed | ✅ | |
| prior_attempt | Prior implementation attempt? | — | Neutral flag |
| prior_attempt_notes | Prior attempt notes | — | Shows if prior_attempt = Yes |

### Section: Engagement Type
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| engagement_types | Engagement type(s) | ✅ | Multi-select |
| csi_involvement | CS&I involvement needed | ✅ | |
| csi_reason | Reason / notes | — | |

### Section: Qualifying Flags
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| flag_multi_bu | Multiple business units in scope | — | Neutral flag |
| flag_integration | Integration required to go live | — | Neutral flag |
| flag_large_arr | Large ARR (Enterprise tier) | — | Neutral flag |
| flag_multi_region | Multi-region rollout | — | Neutral flag |
| ta_involvement | TA involvement required | — | Neutral flag |

**Proposed connections from this stage:**
- None currently. Consider: `flag_integration = Yes` → auto-create an integration record stub

---

## Stage 2 — Requirements (Requirements & Scoping)

### Section: Stakeholders
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| primary_contact | Primary contact (name & role) | ✅ | **[CONNECT TO: Stakeholder registry — add as Operational tier, CSM owned]** |
| primary_contact_email | Primary contact email | ✅ | **[CONNECT TO: Stakeholder registry — email field]** |
| it_contact | IT contact (IdP / API admin) | — | **[CONNECT TO: Stakeholder registry — add as Technical tier]** |
| exec_sponsor | Executive sponsor | — | **[CONNECT TO: Stakeholder registry — add as Executive tier, AE owned]** |
| end_user_manager | End-user / frontline manager | — | **[CONNECT TO: Stakeholder registry — add as Operational tier]** |
| runbook_recipient | Config runbook recipient | ✅ | Usually same as IT contact — consider linking |

**⚠️ Key action:** These fields are currently siloed in the capture form. They should auto-populate the Stakeholder registry when filled in. Implementation: on save of CapturePanel data, check if stakeholder entries exist with matching names — if not, create them. If yes, update email. Needs a `syncCapturePanelStakeholders()` function called after CapturePanel save.

### Section: Onboarding Track
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| primary_use_cases | Primary use case(s) | ✅ | Multi-select |
| success_criteria | Success criteria — what does done look like? | ✅ | **[CONNECT TO: Success Plan — pre-populate first objective]** |
| mvp_scope | MVP scope for this onboarding | ✅ | |
| total_users | Total user count | ✅ | |
| users_admin | Admins | — | |
| users_frontline | Frontline workers | — | |
| sites_list | Key sites / locations | ✅ | |
| language_needs | Language / localisation needs | — | |

### Section: CSE / TA — Universal
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| go_live_date | Target go-live date | ✅ | **[CONNECT TO: Engagement closeDate field]** |
| go_live_hard | Deadline type | ✅ | Select |
| blackout_periods | Blackout / unavailable periods | — | |
| security_constraints | Security / compliance constraints | — | |
| integration_platform | Existing integration platform | — | Select |

### Section: SSO / SCIM (conditional — shows if SSO or SCIM selected in Stage 1)
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| idp_name | Identity provider (IdP) | ✅ | |
| sso_scim_both | Requirement (SSO / SCIM / Both) | ✅ | |
| sso_flow | SSO flow type | — | |
| metadata_received | IdP metadata XML / URL received | ✅ | |
| mfa_policy | MFA enforced at IdP level? | — | Neutral |
| deprov_policy | Deprovisioning policy | — | |
| it_admin_confirmed | IT admin confirmed for session 1 | ✅ | |

### Section: API & Data Integration (conditional)
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| systems_inventory | Systems to connect (name, direction, owner) | ✅ | **[CONSIDER: structured field instead of textarea — name + direction + owner per system]** |
| data_direction | Data flow direction | ✅ | |
| datasets_in_scope | Datasets in scope | ✅ | Multi-select |
| refresh_frequency | Required refresh frequency | ✅ | |
| api_token_confirmed | Active API token confirmed | ✅ | |
| developer_available | Internal developer available | ✅ | |

### Section: TA Discovery (conditional)
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| business_problem | Business problem statement | ✅ | |
| sap_version | SAP version | — | |
| tech_decision_maker | Technical decision-maker | ✅ | **[CONNECT TO: Stakeholder registry — Technical tier]** |
| biz_decision_maker | Business sign-off owner | ✅ | **[CONNECT TO: Stakeholder registry — Executive tier]** |

---

## Stage 3 — Technical Review (Technical Session Tracker)

### Section: Pre-Engagement Prep
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| questionnaire_sent | Pre-call questionnaire sent | ✅ | Yes/No + date |
| right_attendees | Right attendees confirmed (IT admin / dev) | ✅ | |
| _(+ additional fields — check CapturePanel.jsx lines 104–122)_ | | | |

_Note: Technical Review section is truncated in the review above — check CapturePanel.jsx lines 98–122 for full field list._

---

## Stage 4 — Onboarding (Onboarding Kickoff Data)

### Section: Kickoff Checklist
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| deck_prepared | Kickoff deck customised | ✅ | |
| kickoff_completed | Kickoff call completed | ✅ | Yes/No + date |
| recap_email_sent | Recap email sent within 24h | ✅ | Yes/No + date |
| sessions_scheduled | All sessions scheduled | ✅ | |
| crm_updated | CRM updated (use case, go-live, stakeholders) | ✅ | |
| integration_flagged | Integration requirements flagged to CSE | — | Neutral |

### Section: Customer Homework
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| user_list_received | User list received | ✅ | Yes/No + date |
| site_list_received | Site list received | ✅ | Yes/No + date |
| templates_received | Priority templates received | ✅ | Yes/No + date |
| templates_detail | Templates detail (names/count) | — | |
| guided_training_assigned | Guided training assigned in-account | ✅ | |

### Section: Onboarding Program
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| session_cadence | Agreed session cadence | ✅ | |
| training_format | End-user training format | ✅ | |
| capacity_constraints | Customer blackouts / constraints | — | |
| large_rollout | Large / complex rollout (phasing required)? | — | Neutral |

---

## Stage 5 — Solution Delivery (Delivery & Build)

### Section: Build Details
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| solution_type | Solution type | ✅ | |
| scope_confirmed | Scope agreed and signed off | ✅ | |
| iteration_limit | Agreed iteration / change cycle limit | — | |
| poc_notes | PoC build notes / key decisions | — | |
| uat_notes | UAT feedback summary | — | |

### Section: Handover Documentation
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| runbook_produced | Configuration runbook produced | ✅ | |
| test_procedure | Test procedure documented | ✅ | |
| customer_holds_creds | Customer holds all credentials | ✅ | |
| cert_expiry | Certificate / token expiry dates noted | ✅ | **[CONNECT TO: Go-Live post-engagement watch fields]** |
| support_intro | Support ticket process introduced | ✅ | |

### Section: Risk Log
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| open_risks | Open technical risks not resolved | — | |
| risks_flagged_csm | Open risks flagged to CSM | — | Neutral |
| post_issues_covered | Post-engagement issues covered in handover | ✅ | |

---

## Stage 6 — Go-Live / Handover (Go-Live & Closure)

### Section: Go-Live Confirmation
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| go_live_actual_date | Actual go-live date | ✅ | |
| hypercare_end | Hypercare end date | ✅ | |
| monitoring_notes | Hypercare monitoring notes | — | |

### Section: Formal Closure
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| runbook_delivered | Config runbook delivered to IT contact | ✅ | |
| sf_closed | Engagement closed in Salesforce | ✅ | |
| csm_handover_complete | CSM handover complete | ✅ | |
| expansion_noted | Expansion opportunities identified | — | Neutral — **[CONNECT TO: Expansion signals — auto-create signal if Yes]** |
| expansion_notes | Expansion notes | — | Shows if expansion_noted = Yes — **[CONNECT TO: Expansion signals description]** |

### Section: Post-Engagement Watch
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| sso_cert_expiry | SSO certificate expiry date | — | |
| api_token_rotation | API token rotation schedule noted | — | Neutral |
| scim_monitoring | SCIM provisioning monitoring advised | — | Neutral |
| rate_limit_briefed | API rate limit expectations set | — | Neutral |

---

## Stage 7 — Ongoing / CSM (Ongoing Engagement)

### Section: Adoption Milestones
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| day30_review | 30-day adoption review | ✅ | Yes/No + date |
| day30_notes | 30-day review notes | — | |
| first_qbr | First QBR completed | ✅ | Yes/No + date — **[CONNECT TO: Success Plan — trigger to create first snapshot]** |
| first_qbr_notes | QBR notes / outcomes | — | **[CONNECT TO: Success Plan — pre-populate CSM notes on first snapshot]** |

### Section: Renewal
| Field | Question | Critical | Notes / Review |
|-------|----------|----------|----------------|
| renewal_date | Renewal date | — | **⚠️ DUPLICATE — renewal now lives on customer record. Remove this field or make it a read-only display of customer.renewalDate** |
| renewal_risk | Renewal at risk? | — | Neutral — **[CONNECT TO: customer.renewalStatus = at_risk if Yes]** |
| expansion_opportunity | Expansion opportunity notes | — | **[CONNECT TO: Expansion signals]** |

---

## Proposed data connections (summary)

| Source field | → | Destination |
|---|---|---|
| requirements.primary_contact | → | Stakeholder registry (Operational, CSM owned) |
| requirements.primary_contact_email | → | Stakeholder registry (email) |
| requirements.it_contact | → | Stakeholder registry (Technical tier) |
| requirements.exec_sponsor | → | Stakeholder registry (Executive tier, AE owned) |
| requirements.end_user_manager | → | Stakeholder registry (Operational tier) |
| requirements.tech_decision_maker | → | Stakeholder registry (Technical tier) |
| requirements.biz_decision_maker | → | Stakeholder registry (Executive tier) |
| requirements.success_criteria | → | Success Plan — first objective description |
| requirements.go_live_date | → | Engagement closeDate |
| go-live.expansion_noted + expansion_notes | → | Customer expansion signals |
| csm-ongoing.first_qbr (completed) | → | Trigger: create first Success Plan snapshot |
| csm-ongoing.first_qbr_notes | → | Success Plan snapshot — CSM notes |
| csm-ongoing.renewal_date | → | Remove — use customer.renewalDate instead |
| csm-ongoing.renewal_risk = Yes | → | customer.renewalStatus = at_risk |
| csm-ongoing.expansion_opportunity | → | Expansion signals |

---

## Implementation notes

**How to wire the stakeholder sync:**

In `EngagementDetail.jsx`, after `CapturePanel` saves capture data for the `requirements` stage, call a new function `syncCapturePanelToStakeholders()` that:
1. Reads the current capture data for `requirements`
2. For each of: `primary_contact`, `it_contact`, `exec_sponsor`, `end_user_manager`
3. Checks if a stakeholder with that name already exists in `customer.stakeholders`
4. If not: adds a new entry with appropriate tier/owner defaults
5. If yes: updates the email if `primary_contact_email` was provided

The customer record is accessible via `engagement.customerId` → Firestore.

**How to wire the expansion signal sync (go-live stage):**

In `CapturePanel` (or on save in `EngagementDetail`), when `go-live.expansion_noted = Yes` and `expansion_notes` is non-empty, check if an expansion signal already exists with matching text — if not, create one with type `upsell_opportunity` and status `new`.

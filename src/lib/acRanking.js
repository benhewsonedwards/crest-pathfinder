// ─── AC Manager ranking helpers ───────────────────────────────────────────────
// Shared between ACManagerPage and ACRequestPage

export const DEFAULT_WEIGHTS = { arr: 0.30, priority: 0.30, deadlineProximity: 0.25, workEstimate: 0.15 };
export const DEFAULT_ARR_CEILING = 500000;

function normArr(arr, ceiling = 500000) { return Math.min((arr || 0) / ceiling, 1); }
function normPriority(p) { return { Critical: 1.0, High: 0.75, Medium: 0.5, Low: 0.25 }[p] ?? 0; }
function normWorkEst(w)  { return { high: 1.0, medium: 0.5, low: 0.25 }[w] ?? 0; }

function normDeadline(req) {
  const d = req.preferredCompletion;
  if (!d) return 0;
  const ts = d.toDate ? d.toDate() : new Date(d);
  const days = (ts - Date.now()) / 86400000;
  if (days < 0) return 1;
  const raw = Math.max(0, 1 - days / 90);
  return req.deadlineType === "soft" ? raw * 0.6 : raw;
}

export function calcScore(req, weights = DEFAULT_WEIGHTS, arrCeiling = DEFAULT_ARR_CEILING) {
  const base =
    normArr(req.arr, arrCeiling)  * weights.arr +
    normPriority(req.sfPriority)  * weights.priority +
    normDeadline(req)             * weights.deadlineProximity +
    normWorkEst(req.workEstimate) * weights.workEstimate;
  return base * (req.escalationMultiplier ?? 1.0);
}

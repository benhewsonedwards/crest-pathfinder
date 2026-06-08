import { useState, useEffect } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { calcScore, DEFAULT_WEIGHTS } from "../lib/acRanking";
import { Card, Btn, Label, Pill } from "../components/UI";

// ─── Sample requests for the live preview ─────────────────────────────────────
const PREVIEW_REQUESTS = [
  { id: "p1", accountName: "Network Rail",      priority: "Critical", arr: 420000, workEstimate: "high",   deadlineType: "hard", preferredCompletion: { toDate: () => new Date(Date.now() + 14 * 86400000) }, escalationMultiplier: 1.5 },
  { id: "p2", accountName: "Altrad",            priority: "High",     arr: 185000, workEstimate: "high",   deadlineType: "hard", preferredCompletion: { toDate: () => new Date(Date.now() + 28 * 86400000) }, escalationMultiplier: 1.0 },
  { id: "p3", accountName: "Schneider Electric",priority: "Medium",   arr: 310000, workEstimate: "medium", deadlineType: "soft", preferredCompletion: { toDate: () => new Date(Date.now() + 45 * 86400000) }, escalationMultiplier: 1.0 },
  { id: "p4", accountName: "Prysmian Group",    priority: "Medium",   arr: 95000,  workEstimate: "medium", deadlineType: null,   preferredCompletion: null, escalationMultiplier: 1.0 },
  { id: "p5", accountName: "OVO Energy",        priority: "Low",      arr: 68000,  workEstimate: "low",    deadlineType: "soft", preferredCompletion: { toDate: () => new Date(Date.now() + 90 * 86400000) }, escalationMultiplier: 1.0 },
];

// ─── Weight slider ─────────────────────────────────────────────────────────────

function WeightSlider({ label, description, value, onChange, colour }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{label}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{description}</span>
        </div>
        <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 15, color: colour, minWidth: 36, textAlign: "right" }}>
          {Math.round(value * 100)}%
        </span>
      </div>
      <div style={{ position: "relative", height: 6, background: "var(--border)", borderRadius: 99 }}>
        <div style={{ position: "absolute", left: 0, width: `${value * 100}%`, height: "100%", background: colour, borderRadius: 99, transition: "width 0.1s" }} />
        <input
          type="range" min={0} max={100} step={5}
          value={Math.round(value * 100)}
          onChange={e => onChange(parseInt(e.target.value) / 100)}
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            opacity: 0, cursor: "pointer", margin: 0,
          }}
        />
      </div>
    </div>
  );
}

// ─── ARR ceiling config ───────────────────────────────────────────────────────

const ARR_PRESETS = [
  { label: "£100k", value: 100000 },
  { label: "£250k", value: 250000 },
  { label: "£500k", value: 500000 },
  { label: "£1M",   value: 1000000 },
];

// ─── Preview table ─────────────────────────────────────────────────────────────

function PreviewTable({ weights, arrCeiling, prevWeights, prevArrCeiling }) {
  function scoreWith(w, ceiling) {
    return PREVIEW_REQUESTS.map(r => {
      const normArr = Math.min((r.arr || 0) / ceiling, 1);
      const normPriority = { Critical: 1.0, High: 0.75, Medium: 0.5, Low: 0.25 }[r.priority] ?? 0;
      const normWork = { high: 1.0, medium: 0.5, low: 0.25 }[r.workEstimate] ?? 0;
      let normDeadline = 0;
      if (r.preferredCompletion) {
        const d = r.preferredCompletion.toDate ? r.preferredCompletion.toDate() : new Date(r.preferredCompletion);
        const days = (d - Date.now()) / 86400000;
        const raw = days < 0 ? 1 : Math.max(0, 1 - days / 90);
        normDeadline = r.deadlineType === "soft" ? raw * 0.6 : raw;
      }
      const base = normArr * w.arr + normPriority * w.priority + normDeadline * w.deadlineProximity + normWork * w.workEstimate;
      return { ...r, score: Math.round(base * (r.escalationMultiplier ?? 1) * 100) };
    }).sort((a, b) => b.score - a.score);
  }

  const current  = scoreWith(weights, arrCeiling);
  const previous = scoreWith(prevWeights, prevArrCeiling);
  const prevRankMap = {};
  previous.forEach((r, i) => { prevRankMap[r.id] = i + 1; });

  return (
    <div>
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
        Live preview — top 5 requests
      </p>
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 70px 70px 60px", gap: 10, padding: "7px 14px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>#</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>Account</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "right" }}>Score</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "right" }}>Previous</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", textAlign: "right" }}>Change</span>
        </div>
        {current.map((r, i) => {
          const prevRank = prevRankMap[r.id];
          const prevScore = previous.find(p => p.id === r.id)?.score ?? 0;
          const rankDiff = prevRank - (i + 1); // positive = moved up
          const scoreDiff = r.score - prevScore;
          return (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "28px 1fr 70px 70px 60px", gap: 10, padding: "9px 14px", borderBottom: i < current.length - 1 ? "1px solid var(--border)" : "none", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? "var(--purple)" : "var(--text-muted)" }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>{r.accountName}</span>
              <span style={{ fontSize: 12, fontWeight: 700, textAlign: "right", color: r.score >= 70 ? "var(--red)" : r.score >= 40 ? "var(--amber)" : "var(--green)" }}>{r.score}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>{prevScore}</span>
              <span style={{ fontSize: 11, fontWeight: 600, textAlign: "right", color: scoreDiff > 0 ? "var(--green)" : scoreDiff < 0 ? "var(--red)" : "var(--text-muted)" }}>
                {scoreDiff === 0 ? "—" : scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff}
                {rankDiff !== 0 && (
                  <span style={{ marginLeft: 4, fontSize: 10 }}>{rankDiff > 0 ? "↑" : "↓"}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Settings page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const [saved, setSaved]           = useState({ weights: DEFAULT_WEIGHTS, arrCeiling: 500000 });
  const [weights, setWeights]       = useState(DEFAULT_WEIGHTS);
  const [arrCeiling, setArrCeiling] = useState(500000);
  const [saving, setSaving]         = useState(false);
  const [justSaved, setJustSaved]   = useState(false);
  const [loaded, setLoaded]         = useState(false);

  // Load from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "acrSettings", "config"), snap => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.rankingWeights) {
          setWeights(d.rankingWeights);
          setSaved(s => ({ ...s, weights: d.rankingWeights }));
        }
        if (d.arrCeiling) {
          setArrCeiling(d.arrCeiling);
          setSaved(s => ({ ...s, arrCeiling: d.arrCeiling }));
        }
      }
      setLoaded(true);
    });
    return unsub;
  }, []);

  const total = Math.round((weights.arr + weights.priority + weights.deadlineProximity + weights.workEstimate) * 100);
  const isValid = total === 100;
  const isDirty = JSON.stringify(weights) !== JSON.stringify(saved.weights) || arrCeiling !== saved.arrCeiling;

  function setWeight(key, val) {
    setWeights(w => ({ ...w, [key]: val }));
  }

  // Auto-balance: when one slider moves, scale the others proportionally
  function setWeightBalanced(key, val) {
    const remaining = Math.round((1 - val) * 100) / 100;
    const others = ["arr", "priority", "deadlineProximity", "workEstimate"].filter(k => k !== key);
    const currentSum = others.reduce((s, k) => s + weights[k], 0);
    if (currentSum === 0) {
      const each = remaining / others.length;
      const newW = { ...weights, [key]: val };
      others.forEach(k => { newW[k] = Math.round(each * 20) / 20; }); // round to 0.05
      setWeights(newW);
    } else {
      const scale = remaining / currentSum;
      const newW = { ...weights, [key]: val };
      others.forEach(k => { newW[k] = Math.round(weights[k] * scale * 20) / 20; });
      // Fix rounding drift
      const newTotal = Object.values(newW).reduce((s, v) => s + v, 0);
      const drift = Math.round((1 - newTotal) * 100) / 100;
      if (drift !== 0) {
        const lastOther = others[others.length - 1];
        newW[lastOther] = Math.round((newW[lastOther] + drift) * 100) / 100;
      }
      setWeights(newW);
    }
  }

  async function handleSave() {
    if (!isValid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "acrSettings", "config"), {
        rankingWeights: weights,
        arrCeiling,
      }, { merge: true });
      setSaved({ weights, arrCeiling });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const WEIGHT_COLOURS = {
    arr:              "var(--purple)",
    priority:         "var(--red)",
    deadlineProximity:"var(--amber)",
    workEstimate:     "var(--blue)",
  };

  return (
    <div style={{ padding: "24px 28px 64px", maxWidth: 760 }}>
      <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 28 }}>Platform configuration and ranking formula.</p>

      {/* ── AC Manager Ranking ─────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 4 }}>AC Manager — ranking formula</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
          Adjust how much each factor contributes to the priority score. Sliders auto-balance to stay at 100%.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>

          {/* Left: sliders */}
          <div>
            <Card style={{ padding: "20px 22px", marginBottom: 14 }}>
              <WeightSlider
                label="ARR"
                description="Account revenue size"
                value={weights.arr}
                onChange={v => setWeightBalanced("arr", v)}
                colour={WEIGHT_COLOURS.arr}
              />
              <WeightSlider
                label="Priority"
                description="SF priority field"
                value={weights.priority}
                onChange={v => setWeightBalanced("priority", v)}
                colour={WEIGHT_COLOURS.priority}
              />
              <WeightSlider
                label="Deadline proximity"
                description="How close the deadline is"
                value={weights.deadlineProximity}
                onChange={v => setWeightBalanced("deadlineProximity", v)}
                colour={WEIGHT_COLOURS.deadlineProximity}
              />
              <WeightSlider
                label="Work estimate"
                description="Low / Medium / High effort"
                value={weights.workEstimate}
                onChange={v => setWeightBalanced("workEstimate", v)}
                colour={WEIGHT_COLOURS.workEstimate}
              />

              {/* Total indicator */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Total weight</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: isValid ? "var(--green)" : "var(--red)" }}>
                  {total}% {isValid ? "✓" : "— must equal 100%"}
                </span>
              </div>
            </Card>

            {/* ARR ceiling */}
            <Card style={{ padding: "18px 22px", marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>ARR normalisation ceiling</p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
                Accounts at or above this ARR score 1.0 for the ARR factor. Set it to roughly your largest account ARR so scores are spread meaningfully.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ARR_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setArrCeiling(p.value)}
                    style={{
                      padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", border: "1px solid",
                      background: arrCeiling === p.value ? "var(--purple-light)" : "transparent",
                      borderColor: arrCeiling === p.value ? "var(--purple)" : "var(--border)",
                      color: arrCeiling === p.value ? "var(--purple)" : "var(--text-second)",
                      fontFamily: "inherit", transition: "all 0.13s",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                Current: accounts ≥ {arrCeiling >= 1000000 ? `£${arrCeiling/1000000}M` : `£${arrCeiling/1000}k`} score 1.0 for ARR
              </p>
            </Card>

            {/* Save */}
            <Btn
              variant={justSaved ? "success" : isDirty ? "primary" : "secondary"}
              onClick={handleSave}
              disabled={saving || !isValid || !isDirty}
              style={{ width: "100%" }}
            >
              {saving ? "Saving…" : justSaved ? "✓ Saved" : isDirty ? "Save ranking config" : "No changes"}
            </Btn>
          </div>

          {/* Right: live preview */}
          <div>
            {loaded && (
              <PreviewTable
                weights={weights}
                arrCeiling={arrCeiling}
                prevWeights={saved.weights}
                prevArrCeiling={saved.arrCeiling}
              />
            )}
            {/* Weight breakdown donut-style bar */}
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>
                Weight breakdown
              </p>
              <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", gap: 1 }}>
                {[
                  { key: "arr",               label: "ARR" },
                  { key: "priority",           label: "Priority" },
                  { key: "deadlineProximity",  label: "Deadline" },
                  { key: "workEstimate",       label: "Work est." },
                ].map(({ key, label }) => (
                  <div
                    key={key}
                    title={`${label}: ${Math.round(weights[key] * 100)}%`}
                    style={{ flex: weights[key], background: WEIGHT_COLOURS[key], transition: "flex 0.2s" }}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                {[
                  { key: "arr",               label: "ARR" },
                  { key: "priority",           label: "Priority" },
                  { key: "deadlineProximity",  label: "Deadline" },
                  { key: "workEstimate",       label: "Work est." },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: WEIGHT_COLOURS[key], flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{label} {Math.round(weights[key] * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Platform status ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Platform status</h2>

        <div style={{ background: "var(--surface)", border: "1px solid var(--green)", borderRadius: "var(--radius-lg)", padding: "14px 18px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--green)" }}>✓</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--green)" }}>Firestore security rules deployed</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Locked to @safetyculture.io accounts. Rules last updated June 2026.</p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 18px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--amber)" }}>◐</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>File uploads — Blaze plan required</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Firebase Storage requires Blaze (pay-as-you-go) plan. UI ready — upgrade to activate.</p>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--amber)" }}>◐</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Salesforce sync — Workato recipe not yet built</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>AC Manager is running on seeded test data. Build Workato recipe to pull live SF data.</p>
        </div>
      </div>

      {/* ── Roadmap ──────────────────────────────────────────────────────── */}
      <div>
        <h2 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Roadmap</h2>
        <Card style={{ padding: "4px 0" }}>
          {[
            { done: true,  label: "Customer lifecycle management (7 stages)" },
            { done: true,  label: "Data capture forms (all stages)" },
            { done: true,  label: "Integration portfolio per customer" },
            { done: true,  label: "Customer share links with task interaction" },
            { done: true,  label: "Role-based access — three-tier system" },
            { done: true,  label: "Firestore security rules + indexes deployed" },
            { done: true,  label: "My Dashboard — calendar, task list, call prep" },
            { done: true,  label: "AC Manager — leaderboard, ranking, milestone timeline" },
            { done: true,  label: "Pre-set user roles before first sign-in" },
            { amber: true, label: "File uploads — waiting on Blaze plan upgrade" },
            { done: false, label: "Salesforce sync — Workato recipe for AC requests" },
            { done: false, label: "AC Manager settings — ranking weights ← you are here" },
            { done: false, label: "Jira sync — live ticket status in engagement view" },
            { done: false, label: "Email notifications — overdue tasks & stage advances" },
            { done: false, label: "Global search (Cmd+K)" },
          ].map((item, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 18px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
              <span style={{ color: item.done ? "var(--green)" : item.amber ? "var(--amber)" : "var(--text-muted)", fontSize: 13, flexShrink: 0 }}>
                {item.done ? "✓" : item.amber ? "◐" : "○"}
              </span>
              <span style={{ fontSize: 13, color: item.done ? "var(--text-second)" : "var(--text-primary)" }}>{item.label}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

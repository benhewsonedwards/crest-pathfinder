import { useState, useEffect } from "react";
import { collection, onSnapshot, query, orderBy, doc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { STAGES, STAGE_KEYS, RAG_STATUSES, REGIONS, SEGMENTS, fmtDate, timeAgo } from "../lib/constants";
import { Card, CardHeader, Label, Pill, Avatar, Btn, Input, Select, Spinner, EmptyState, Modal } from "../components/UI";
import EngagementModal from "../components/EngagementModal";

export default function EngagementsPage({ onSelectEngagement, onNewEngagement, users, customers = [] }) {
  const { profile } = useAuth();
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [ragFilter, setRagFilter] = useState("");
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canEdit = ["super_admin", "admin", "cse", "csm", "com"].includes(profile?.role);
  const canDelete = ["super_admin", "admin"].includes(profile?.role);

  useEffect(() => {
    const q = query(collection(db, "engagements"), orderBy("updatedAt", "desc"));
    return onSnapshot(q, snap => {
      setEngagements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const filtered = engagements.filter(e => {
    if (search && !e.customer?.toLowerCase().includes(search.toLowerCase()) &&
        !e.csId?.toLowerCase().includes(search.toLowerCase())) return false;
    if (stageFilter && e.currentStage !== stageFilter) return false;
    if (regionFilter && e.region !== regionFilter) return false;
    if (ragFilter && e.ragStatus !== ragFilter) return false;
    return true;
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteDoc(doc(db, "engagements", deleteTarget.id));
    setDeleteTarget(null);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <Spinner size={28} />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Engagements</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{engagements.length} total · {filtered.length} shown</p>
        </div>
        {canEdit && <Btn onClick={onNewEngagement}>+ New engagement</Btn>}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 13 }}>🔍</span>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer or CS ID..." style={{ paddingLeft: 30 }}/>
        </div>
        <Select value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={{ width: 140 }}>
          <option value="">All stages</option>
          {STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
        </Select>
        <Select value={regionFilter} onChange={e => setRegionFilter(e.target.value)} style={{ width: 110 }}>
          <option value="">All regions</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select value={ragFilter} onChange={e => setRagFilter(e.target.value)} style={{ width: 120 }}>
          <option value="">All RAG</option>
          {RAG_STATUSES.map(r => <option key={r.key} value={r.key}>{r.emoji} {r.label}</option>)}
        </Select>
        {(search || stageFilter || regionFilter || ragFilter) && (
          <Btn variant="ghost" size="sm" onClick={() => { setSearch(""); setStageFilter(""); setRegionFilter(""); setRagFilter(""); }}>
            Clear
          </Btn>
        )}
      </div>

      {/* Table */}
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 90px 80px 90px 70px 80px 72px", gap: 8, padding: "9px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
          {["Customer", "Stage", "Region", "Size", "ARR", "RAG", "Updated", ""].map(h => <Label key={h}>{h}</Label>)}
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon="📋" title="No engagements found" description={search || stageFilter || regionFilter || ragFilter ? "Try adjusting your filters" : "Create your first engagement to get started"} action={!search && canEdit && <Btn onClick={onNewEngagement}>+ New engagement</Btn>}/>
        ) : filtered.map((e, i) => {
          const stage = STAGES.find(s => s.key === e.currentStage);
          const rag = RAG_STATUSES.find(r => r.key === e.ragStatus) || RAG_STATUSES[0];
          const allTasks = STAGE_KEYS.flatMap(sk => e.stageTasks?.[sk] || []);
          const pct = allTasks.length > 0 ? Math.round((allTasks.filter(t=>t.done).length / allTasks.length) * 100) : 0;

          return (
            <div key={e.id} style={{
              display: "grid", gridTemplateColumns: "1fr 110px 90px 80px 90px 70px 80px 72px",
              gap: 8, padding: "11px 18px", borderBottom: i < filtered.length-1 ? "1px solid var(--border)" : "none",
              alignItems: "center", transition: "background 0.1s",
            }}
            onMouseEnter={ev => ev.currentTarget.style.background = "var(--surface2)"}
            onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}
            >
              {/* Customer */}
              <div style={{ cursor: "pointer" }} onClick={() => onSelectEngagement(e)}>
                <p style={{ fontWeight: 500, fontSize: 13 }}>{e.customer}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.csId || e.sfOppId || "No ID"}</p>
                {allTasks.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <div style={{ width: 60, height: 3, borderRadius: 99, background: "var(--border)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct===100?"var(--green)":"var(--purple)", borderRadius: 99 }}/>
                    </div>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{pct}%</span>
                  </div>
                )}
              </div>

              {/* Stage */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }} onClick={() => onSelectEngagement(e)}>
                <span style={{ fontSize: 13 }}>{stage?.icon}</span>
                <span style={{ fontSize: 11, color: stage?.colour, fontWeight: 600 }}>{stage?.shortLabel}</span>
              </div>

              <span style={{ fontSize: 12, color: "var(--text-second)", cursor: "pointer" }} onClick={() => onSelectEngagement(e)}>{e.region || "—"}</span>
              <span style={{ fontSize: 12, color: "var(--text-second)", cursor: "pointer" }} onClick={() => onSelectEngagement(e)}>{e.tshirt || "—"}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: e.arr ? "var(--text-primary)" : "var(--text-muted)", cursor: "pointer" }} onClick={() => onSelectEngagement(e)}>
                {e.arr ? `£${Number(e.arr).toLocaleString()}` : "—"}
              </span>
              <Pill color={rag.key==="green"?"green":rag.key==="red"?"red":"amber"} style={{ fontSize: 10 }}>{rag.emoji} {rag.label}</Pill>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{e.updatedAt ? timeAgo(e.updatedAt) : "—"}</span>

              {/* Actions */}
              <div style={{ display: "flex", gap: 4 }}>
                {canEdit && (
                  <button onClick={ev => { ev.stopPropagation(); setEditTarget(e); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", padding: "3px 6px", borderRadius: 4 }}
                    onMouseEnter={ev => ev.currentTarget.style.color = "var(--purple)"}
                    onMouseLeave={ev => ev.currentTarget.style.color = "var(--text-muted)"}
                    title="Edit">✏️</button>
                )}
                {canDelete && (
                  <button onClick={ev => { ev.stopPropagation(); setDeleteTarget(e); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", padding: "3px 6px", borderRadius: 4 }}
                    onMouseEnter={ev => ev.currentTarget.style.color = "var(--red)"}
                    onMouseLeave={ev => ev.currentTarget.style.color = "var(--text-muted)"}
                    title="Delete">🗑</button>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Edit modal */}
      {editTarget && (
        <EngagementModal open={!!editTarget} onClose={() => setEditTarget(null)} initial={editTarget} users={users} customers={customers}/>
      )}

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete engagement" width={400}>
        <p style={{ fontSize: 13, color: "var(--text-second)", marginBottom: 20 }}>
          Are you sure you want to delete <strong>{deleteTarget?.customer}</strong>? This will permanently remove all tasks, activity logs, and data capture. This cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Btn>
          <Btn variant="danger" onClick={handleDelete}>Delete permanently</Btn>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, query, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { ROLES, JOB_FUNCTIONS } from "../lib/constants";
import { Card, CardHeader, Label, Pill, Avatar, Btn, Select, Input, Modal, FieldGroup, Spinner, EmptyState } from "../components/UI";

function RolePill({ role }) {
  const colours = {
    super_admin: "red", admin: "orange", cse: "purple", csm: "teal",
    com: "blue", ae: "amber", ta: "green", viewer: "grey",
  };
  return <Pill color={colours[role] || "grey"} style={{ fontSize: 10, textTransform: "capitalize" }}>{role?.replace("_", " ")}</Pill>;
}

export default function TeamPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [addingTeam, setAddingTeam] = useState(false);
  const [activeTab, setActiveTab] = useState("members");

  const isSuperAdmin = profile?.role === "super_admin";
  const isAdmin = ["super_admin", "admin"].includes(profile?.role);

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(collection(db, "teams"), snap => {
      setTeams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  async function updateUser(uid, updates) {
    await updateDoc(doc(db, "users", uid), updates);
  }

  async function addTeam() {
    if (!newTeamName.trim()) return;
    await addDoc(collection(db, "teams"), {
      name: newTeamName.trim(), members: [], createdAt: serverTimestamp(),
    });
    setNewTeamName("");
    setAddingTeam(false);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
      <Spinner size={28} />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 2 }}>Team & Hierarchy</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{users.length} members · {teams.length} teams</p>
        </div>
        {isAdmin && (
          <Btn onClick={() => setAddingTeam(true)} variant="secondary">+ New team</Btn>
        )}
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20, gap: 2 }}>
        {[["members", "Members"], ["teams", "Teams"]].map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            padding: "8px 16px", fontSize: 13, cursor: "pointer", background: "none",
            border: "none", borderBottom: `2px solid ${activeTab===id?"var(--purple)":"transparent"}`,
            color: activeTab===id?"var(--purple)":"var(--text-second)", fontWeight: activeTab===id?600:400,
            fontFamily: "inherit", marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* Members tab */}
      {activeTab === "members" && (
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 120px 120px 80px", gap: 10, padding: "9px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
            {["Member", "Function", "Role", "Team", ""].map(h => <Label key={h}>{h}</Label>)}
          </div>
          {users.length === 0 ? (
            <EmptyState icon="👥" title="No team members yet" description="Members will appear here once they sign in with their SafetyCulture Google account"/>
          ) : users.map((u, i) => (
            <div key={u.uid} style={{
              display: "grid", gridTemplateColumns: "1fr 100px 120px 120px 80px",
              gap: 10, padding: "11px 18px", borderBottom: i < users.length-1 ? "1px solid var(--border)" : "none",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={u.displayName} photoURL={u.photoURL} size={32}/>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{u.displayName}</p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.email}</p>
                </div>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-second)" }}>{u.jobFunction || "—"}</span>
              <RolePill role={u.role}/>
              <span style={{ fontSize: 12, color: "var(--text-second)" }}>
                {teams.find(t => t.members?.includes(u.uid))?.name || "—"}
              </span>
              {isAdmin && (
                <Btn size="sm" variant="ghost" onClick={() => setEditingUser(u)}>Edit</Btn>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* Teams tab */}
      {activeTab === "teams" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {teams.length === 0 ? (
            <EmptyState icon="🏢" title="No teams yet" description="Create teams to organise your members" action={isAdmin && <Btn onClick={() => setAddingTeam(true)}>+ New team</Btn>}/>
          ) : teams.map(team => {
            const members = users.filter(u => team.members?.includes(u.uid));
            return (
              <Card key={team.id}>
                <CardHeader>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 13 }}>{team.name}</span>
                    <Pill color="grey" style={{ fontSize: 10 }}>{members.length} member{members.length !== 1 ? "s" : ""}</Pill>
                  </div>
                </CardHeader>
                <div style={{ padding: "12px 18px" }}>
                  {members.length === 0 ? (
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No members yet</p>
                  ) : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {members.map(u => (
                        <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "5px 10px" }}>
                          <Avatar name={u.displayName} photoURL={u.photoURL} size={22}/>
                          <span style={{ fontSize: 12 }}>{u.displayName}</span>
                          <RolePill role={u.role}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit user modal */}
      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} title={`Edit — ${editingUser?.displayName}`} width={440}>
        {editingUser && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, padding: "12px 14px", background: "var(--surface2)", borderRadius: "var(--radius)" }}>
              <Avatar name={editingUser.displayName} photoURL={editingUser.photoURL} size={40}/>
              <div>
                <p style={{ fontWeight: 600 }}>{editingUser.displayName}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{editingUser.email}</p>
              </div>
            </div>
            <FieldGroup label="Role">
              <Select value={editingUser.role || "viewer"} onChange={e => setEditingUser(u => ({ ...u, role: e.target.value }))}>
                {ROLES.filter(r => isSuperAdmin || r.key !== "super_admin").map(r => (
                  <option key={r.key} value={r.key}>{r.label} — {r.description}</option>
                ))}
              </Select>
            </FieldGroup>
            <FieldGroup label="Job function">
              <Select value={editingUser.jobFunction || ""} onChange={e => setEditingUser(u => ({ ...u, jobFunction: e.target.value }))}>
                <option value="">— select —</option>
                {JOB_FUNCTIONS.map(j => <option key={j}>{j}</option>)}
              </Select>
            </FieldGroup>
            <FieldGroup label="Team">
              <Select value={teams.find(t => t.members?.includes(editingUser.uid))?.id || ""} onChange={async e => {
                // Remove from all teams, then add to selected
                for (const t of teams) {
                  if (t.members?.includes(editingUser.uid)) {
                    await updateDoc(doc(db, "teams", t.id), { members: t.members.filter(m => m !== editingUser.uid) });
                  }
                }
                if (e.target.value) {
                  const team = teams.find(t => t.id === e.target.value);
                  await updateDoc(doc(db, "teams", e.target.value), { members: [...(team.members || []), editingUser.uid] });
                }
              }}>
                <option value="">— no team —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </FieldGroup>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
              <Btn variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Btn>
              <Btn onClick={async () => {
                await updateUser(editingUser.uid, { role: editingUser.role, jobFunction: editingUser.jobFunction });
                setEditingUser(null);
              }}>Save changes</Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* New team modal */}
      <Modal open={addingTeam} onClose={() => setAddingTeam(false)} title="New team" width={380}>
        <FieldGroup label="Team name" required>
          <Input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="e.g. EMEA CS&I"/>
        </FieldGroup>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <Btn variant="ghost" onClick={() => setAddingTeam(false)}>Cancel</Btn>
          <Btn onClick={addTeam} disabled={!newTeamName.trim()}>Create team</Btn>
        </div>
      </Modal>
    </div>
  );
}

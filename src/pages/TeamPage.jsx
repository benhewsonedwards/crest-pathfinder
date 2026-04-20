import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { ROLES as APP_ROLES } from "../lib/constants";
import { Card, CardHeader, Label, Pill, Avatar, Btn, Select, Modal, FieldGroup, Spinner } from "../components/UI";
import { PEOPLE } from "../lib/people";

const ORG = [
  {
    key: "csi", name: "Solutions & Implementation",
    manager: "edwin.davidian@safetyculture.io", colour: "var(--purple)",
    members: PEOPLE.filter(p => p.team === "Solutions & Implementation"),
  },
  {
    key: "cs", name: "Customer Success",
    manager: "pascale.radford@safetyculture.io", colour: "var(--green)",
    members: PEOPLE.filter(p => p.team === "Customer Success"),
  },
  {
    key: "sales", name: "Sales EMEA",
    manager: null, colour: "var(--amber)",
    members: PEOPLE.filter(p => p.team === "Sales EMEA"),
  },
];

const ROLE_COLOUR = { cse: "purple", com: "blue", im: "teal", csm: "green", ae: "amber", manager: "grey" };
const ROLE_LABEL  = { cse: "CSE", com: "COM", im: "IM", csm: "CSM", ae: "AE", manager: "Manager" };
const APP_ROLE_COLOUR = { super_admin: "red", admin: "orange", cse: "purple", csm: "teal", com: "blue", ae: "amber", viewer: "grey" };

function RolePill({ roleKey }) {
  return <Pill color={ROLE_COLOUR[roleKey] || "grey"} style={{ fontSize: 10 }}>{ROLE_LABEL[roleKey] || roleKey}</Pill>;
}
function AppRolePill({ role }) {
  return <Pill color={APP_ROLE_COLOUR[role] || "grey"} style={{ fontSize: 10 }}>{role?.replace("_", " ")}</Pill>;
}

function PersonRow({ person, fbUser, isAdmin, onEdit, teamColour, showTeam }) {
  const initials = person.initials || person.name.split(" ").map(n => n[0]).join("").slice(0, 2);
  const cols = showTeam
    ? "36px 1fr 100px 80px 100px 120px 80px"
    : "36px 1fr 80px 100px 120px 80px";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: cols,
      gap: 12, padding: "10px 18px", alignItems: "center",
      borderBottom: "1px solid var(--border)", opacity: fbUser ? 1 : 0.72,
    }}>
      <div style={{ position: "relative" }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: (teamColour || "var(--purple)") + "25",
          color: teamColour || "var(--purple)",
          fontSize: 10, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {fbUser?.photoURL
            ? <img src={fbUser.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
            : initials}
        </div>
        {fbUser && (
          <div style={{ position: "absolute", bottom: 0, right: 0, width: 8, height: 8, borderRadius: "50%", background: "var(--green)", border: "1.5px solid var(--surface)" }} title="Signed in" />
        )}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 1 }}>{person.name}</p>
        <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{person.email}</p>
      </div>
      {showTeam && <span style={{ fontSize: 11, color: "var(--text-second)" }}>{person.team}</span>}
      <span style={{ fontSize: 11, color: "var(--text-second)" }}>{person.location}</span>
      <RolePill roleKey={person.roleKey} />
      {fbUser
        ? <AppRolePill role={fbUser.role} />
        : <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>not signed in yet</span>}
      <div>{isAdmin && fbUser && <Btn size="sm" variant="ghost" onClick={() => onEdit(fbUser)}>Edit</Btn>}</div>
    </div>
  );
}

function TeamCard({ team, fbUsers, isAdmin, onEdit }) {
  const [open, setOpen] = useState(true);
  const manager = team.manager ? team.members.find(p => p.email === team.manager) : null;
  const rest = team.members.filter(p => p.email !== team.manager);
  const signedIn = team.members.filter(p => fbUsers.find(u => u.email === p.email)).length;

  return (
    <Card style={{ marginBottom: 12 }}>
      <CardHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", flex: 1 }} onClick={() => setOpen(o => !o)}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: team.colour, flexShrink: 0 }} />
          <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, color: team.colour }}>{team.name}</span>
          <Pill color="grey" style={{ fontSize: 10 }}>{team.members.length} people</Pill>
          <Pill color="green" style={{ fontSize: 10 }}>{signedIn} signed in</Pill>
          {manager && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· Manager: {manager.name}</span>}
        </div>
        <span style={{ fontSize: 14, color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none", transition: ".2s" }}>⌄</span>
      </CardHeader>
      {open && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 80px 100px 120px 80px", gap: 12, padding: "6px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
            <span /><Label>Name</Label><Label>Location</Label><Label>Team role</Label><Label>App access</Label><span />
          </div>
          {manager && (
            <div style={{ background: team.colour + "08" }}>
              <PersonRow person={manager} fbUser={fbUsers.find(u => u.email === manager.email)} isAdmin={isAdmin} onEdit={onEdit} teamColour={team.colour} showTeam={false} />
            </div>
          )}
          {rest.map(person => (
            <PersonRow key={person.email} person={person} fbUser={fbUsers.find(u => u.email === person.email)} isAdmin={isAdmin} onEdit={onEdit} teamColour={team.colour} showTeam={false} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function TeamPage() {
  const { profile } = useAuth();
  const [fbUsers, setFbUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [tab, setTab] = useState("org");
  const isSuperAdmin = profile?.role === "super_admin";
  const isAdmin = ["super_admin", "admin"].includes(profile?.role);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), snap => {
      setFbUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const signedIn = fbUsers.filter(u => PEOPLE.find(p => p.email === u.email)).length;

  if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}><Spinner size={28} /></div>;

  return (
    <div style={{ padding: "24px 28px 48px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>Team & Org Chart</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {PEOPLE.length} people · {ORG.length} teams ·&nbsp;
          <span style={{ color: "var(--green)" }}>{signedIn} signed in</span>
          {PEOPLE.length - signedIn > 0 && <span style={{ color: "var(--text-muted)" }}> · {PEOPLE.length - signedIn} not yet signed in</span>}
        </p>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 20, gap: 2 }}>
        {[["org", "Org chart"], ["all", "All members"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "8px 16px", fontSize: 13, cursor: "pointer", background: "none", border: "none",
            borderBottom: `2px solid ${tab === id ? "var(--purple)" : "transparent"}`,
            color: tab === id ? "var(--purple)" : "var(--text-second)",
            fontWeight: tab === id ? 600 : 400, fontFamily: "inherit", marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === "org" && ORG.map(team => (
        <TeamCard key={team.key} team={team} fbUsers={fbUsers} isAdmin={isAdmin} onEdit={setEditingUser} />
      ))}

      {tab === "all" && (
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 100px 80px 100px 120px 80px", gap: 12, padding: "6px 18px", background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
            <span /><Label>Name</Label><Label>Team</Label><Label>Location</Label><Label>Role</Label><Label>App access</Label><span />
          </div>
          {PEOPLE.map((person, i) => (
            <PersonRow key={person.email} person={person} fbUser={fbUsers.find(u => u.email === person.email)} isAdmin={isAdmin} onEdit={setEditingUser}
              teamColour={ORG.find(t => t.members.find(m => m.email === person.email))?.colour} showTeam={true} />
          ))}
        </Card>
      )}

      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} title={`Edit — ${editingUser?.displayName}`} width={440}>
        {editingUser && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, padding: "12px 14px", background: "var(--surface2)", borderRadius: "var(--radius)" }}>
              {editingUser.photoURL
                ? <img src={editingUser.photoURL} style={{ width: 40, height: 40, borderRadius: "50%" }} alt="" />
                : <Avatar name={editingUser.displayName} size={40} />}
              <div>
                <p style={{ fontWeight: 600 }}>{editingUser.displayName}</p>
                <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{editingUser.email}</p>
                {editingUser.title && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{editingUser.title}</p>}
              </div>
            </div>
            <FieldGroup label="App role">
              <Select value={editingUser.role || "viewer"} onChange={e => setEditingUser(u => ({ ...u, role: e.target.value }))}>
                {APP_ROLES.filter(r => isSuperAdmin || r.key !== "super_admin").map(r => (
                  <option key={r.key} value={r.key}>{r.label} — {r.description}</option>
                ))}
              </Select>
            </FieldGroup>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, marginBottom: 16, lineHeight: 1.5 }}>
              Team, location and title are synced from the people directory and cannot be edited here.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setEditingUser(null)}>Cancel</Btn>
              <Btn onClick={async () => { await updateDoc(doc(db, "users", editingUser.uid), { role: editingUser.role }); setEditingUser(null); }}>Save changes</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

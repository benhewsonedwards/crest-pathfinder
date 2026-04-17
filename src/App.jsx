import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./lib/firebase";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import PipelinePage from "./pages/PipelinePage";
import EngagementDetail from "./pages/EngagementDetail";
import TeamPage from "./pages/TeamPage";
import IssuesPage from "./pages/IssuesPage";
import Sidebar from "./components/Sidebar";
import EngagementModal from "./components/EngagementModal";
import { Spinner } from "./components/UI";

function AppShell() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState("pipeline");
  const [selectedEngagement, setSelectedEngagement] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
  }, [user]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ textAlign: "center" }}>
          <Spinner size={32} />
          <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>Loading CREST Pathfinder...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  function handleSelectEngagement(eng) {
    setSelectedEngagement(eng);
    setPage("engagements");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar active={selectedEngagement ? "engagements" : page} onChange={p => {
        setPage(p);
        if (p !== "engagements") setSelectedEngagement(null);
      }} />

      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        {selectedEngagement ? (
          <EngagementDetail
            engagement={selectedEngagement}
            onBack={() => { setSelectedEngagement(null); setPage("pipeline"); }}
            users={users}
          />
        ) : page === "pipeline" || page === "engagements" ? (
          <PipelinePage
            onSelectEngagement={handleSelectEngagement}
            onNewEngagement={() => setShowNewModal(true)}
          />
        ) : page === "issues" ? (
          <IssuesPage onSelectEngagement={handleSelectEngagement} />
        ) : page === "team" ? (
          <TeamPage />
        ) : page === "settings" ? (
          <div style={{ padding: "24px 28px" }}>
            <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Settings</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Coming soon — Salesforce and Jira integration configuration.</p>
          </div>
        ) : null}
      </main>

      <EngagementModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        users={users}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

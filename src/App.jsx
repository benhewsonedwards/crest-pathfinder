import { useState, useEffect } from "react";
import { collection, onSnapshot, doc, onSnapshot as docSnap } from "firebase/firestore";
import { db } from "./lib/firebase";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import PipelinePage from "./pages/PipelinePage";
import EngagementsPage from "./pages/EngagementsPage";
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

  // Load all users for assignment dropdowns
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
  }, [user]);

  // Keep selected engagement live — re-subscribe when it changes
  useEffect(() => {
    if (!selectedEngagement?.id) return;
    const unsub = onSnapshot(doc(db, "engagements", selectedEngagement.id), snap => {
      if (snap.exists()) setSelectedEngagement({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [selectedEngagement?.id]);

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

  function handleBack() {
    setSelectedEngagement(null);
    setPage("pipeline");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar
        active={selectedEngagement ? "engagements" : page}
        onChange={p => { setPage(p); if (p !== "engagements") setSelectedEngagement(null); }}
      />

      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        {selectedEngagement ? (
          <EngagementDetail
            engagement={selectedEngagement}
            onBack={handleBack}
            users={users}
          />
        ) : page === "pipeline" ? (
          <PipelinePage
            onSelectEngagement={handleSelectEngagement}
            onNewEngagement={() => setShowNewModal(true)}
          />
        ) : page === "engagements" ? (
          <EngagementsPage
            onSelectEngagement={handleSelectEngagement}
            onNewEngagement={() => setShowNewModal(true)}
            users={users}
          />
        ) : page === "issues" ? (
          <IssuesPage onSelectEngagement={handleSelectEngagement} />
        ) : page === "team" ? (
          <TeamPage />
        ) : page === "settings" ? (
          <div style={{ padding: "24px 28px 48px" }}>
            <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Settings</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Platform configuration and integrations.</p>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px" }}>
              <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Coming soon</h3>
              <ul style={{ fontSize: 13, color: "var(--text-second)", lineHeight: 2, listStyle: "none" }}>
                <li>🔗 Salesforce integration — auto-sync opportunities and CS Requests</li>
                <li>🎫 Jira integration — auto-sync CSE tickets and status updates</li>
                <li>🔒 Firestore security rules — role-based data access</li>
                <li>📧 Email notifications — overdue tasks and stage advances</li>
                <li>🔗 Shareable customer-facing view links</li>
              </ul>
            </div>
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

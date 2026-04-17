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
import CustomersPage from "./pages/CustomersPage";
import CustomerDashboard from "./pages/CustomerDashboard";
import Sidebar from "./components/Sidebar";
import EngagementModal from "./components/EngagementModal";
import { Spinner } from "./components/UI";

// Role-based default landing page
function defaultPage(role) {
  if (role === "csm" || role === "com") return "customers";
  return "pipeline";
}

function AppShell() {
  const { user, profile, loading } = useAuth();
  const [page, setPage] = useState(null); // null = waiting for profile
  const [selectedEngagement, setSelectedEngagement] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [users, setUsers] = useState([]);

  // Set landing page once profile loads
  useEffect(() => {
    if (profile && page === null) {
      setPage(defaultPage(profile.role));
    }
  }, [profile, page]);

  // Load all users for assignment dropdowns
  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
  }, [user]);

  // Keep selected engagement live
  useEffect(() => {
    if (!selectedEngagement?.id) return;
    const unsub = onSnapshot(doc(db, "engagements", selectedEngagement.id), snap => {
      if (snap.exists()) setSelectedEngagement({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [selectedEngagement?.id]);

  // Keep selected customer live
  useEffect(() => {
    if (!selectedCustomer?.id) return;
    const unsub = onSnapshot(doc(db, "customers", selectedCustomer.id), snap => {
      if (snap.exists()) setSelectedCustomer({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [selectedCustomer?.id]);

  if (loading || (user && page === null)) {
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
    setSelectedCustomer(null);
    setPage("engagements");
  }

  function handleSelectCustomer(customer) {
    setSelectedCustomer(customer);
    setSelectedEngagement(null);
    setPage("customers");
  }

  function handleNav(p) {
    setPage(p);
    if (p !== "engagements") setSelectedEngagement(null);
    if (p !== "customers") setSelectedCustomer(null);
  }

  const activePage = selectedEngagement ? "engagements" : selectedCustomer ? "customers" : page;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar active={activePage} onChange={handleNav} />

      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        {/* Engagement detail */}
        {selectedEngagement ? (
          <EngagementDetail
            engagement={selectedEngagement}
            onBack={() => { setSelectedEngagement(null); setPage("pipeline"); }}
            users={users}
          />
        /* Customer dashboard */
        ) : selectedCustomer ? (
          <CustomerDashboard
            customer={selectedCustomer}
            onBack={() => { setSelectedCustomer(null); setPage("customers"); }}
            users={users}
          />
        /* Pages */
        ) : page === "customers" ? (
          <CustomersPage
            onSelectCustomer={handleSelectCustomer}
            onNewCustomer={() => {}}
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

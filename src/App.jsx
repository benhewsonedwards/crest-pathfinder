import { useState, useEffect } from "react";
import { collection, onSnapshot, doc } from "firebase/firestore";
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
import MyDashboard from "./pages/MyDashboard";
import SharePage from "./pages/SharePage";
import ShareLinksPage from "./pages/ShareLinksPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import Sidebar from "./components/Sidebar";
import EngagementModal from "./components/EngagementModal";
import { Spinner } from "./components/UI";

// Role-based default landing page
function defaultPage(role) {
  if (role === "csm" || role === "com") return "customers";
  return "dashboard";
}

function AppShell() {
  const { user, profile, loading } = useAuth();
  const [page, setPage] = useState(null); // null = waiting for profile
  const [selectedEngagement, setSelectedEngagement] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [customers, setCustomers] = useState([]);

  // Set landing page once profile loads
  useEffect(() => {
    if (profile && page === null) {
      setPage(defaultPage(profile.role));
    }
  }, [profile, page]);

  // Load all users for assignment dropdowns
  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(collection(db, "users"), snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    });
    const u2 = onSnapshot(collection(db, "customers"), snap => {
      setCustomers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); };
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
    setPage("pipeline");
  }

  function handleSelectCustomer(customer) {
    setSelectedCustomer(customer);
    setSelectedEngagement(null);
    setPage("customers");
  }

  function handleOpenCustomer(customerId, customerName) {
    // Find customer by ID first, then fall back to name match
    const customer = customerId
      ? customers.find(c => c.id === customerId)
      : customers.find(c => c.name === customerName);
    if (customer) {
      handleSelectCustomer(customer);
    } else if (customerName) {
      // Customer exists as engagement only — navigate to customers page filtered
      setPage("customers");
      setSelectedEngagement(null);
    }
  }

  function handleNav(p) {
    setPage(p);
    if (p !== "pipeline") setSelectedEngagement(null);
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
            customers={customers}
            onOpenCustomer={handleOpenCustomer}
          />
        /* Customer dashboard */
        ) : selectedCustomer ? (
          <CustomerDashboard
            customer={selectedCustomer}
            onBack={() => { setSelectedCustomer(null); setPage("customers"); }}
            users={users}
            onSelectEngagement={handleSelectEngagement}
            onEditCustomer={(c) => {
              // Navigate back to customers list; CustomersPage will show edit modal
              // We use a URL-style signal via a ref so CustomersPage can pick it up
              setSelectedCustomer(null);
              setPage("customers");
              // Small delay so CustomersPage mounts before we try to trigger edit
              setTimeout(() => window.dispatchEvent(new CustomEvent("crest:editCustomer", { detail: c })), 100);
            }}
          />
        /* Pages */
        ) : page === "dashboard" ? (
          <MyDashboard
            onSelectEngagement={handleSelectEngagement}
            users={users}
          />
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
            customers={customers}
          />
        ) : page === "integrations" ? (
          <IntegrationsPage
            onSelectCustomer={c => {
              const customer = customers.find(cu => cu.id === c.customerId);
              if (customer) handleSelectCustomer(customer);
            }}
          />
        ) : page === "issues" ? (
          <IssuesPage onSelectEngagement={handleSelectEngagement} />
        ) : page === "team" ? (
          <TeamPage />
        ) : page === "sharelinks" ? (
          <ShareLinksPage />
        ) : page === "settings" ? (
          <div style={{ padding: "24px 28px 48px" }}>
            <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Settings</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>Platform configuration and integration status.</p>

            {/* Security */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>🔒 Firestore security rules</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>Rules are written and committed. Deploy them once to lock down the database.</p>
              <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "var(--text-second)" }}>
                firebase deploy --only firestore:rules,firestore:indexes
              </div>
            </div>

            {/* Data seed */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 16 }}>
              <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 4 }}>🌱 EMEA data seed</h3>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>11 EMEA engagements ready to seed from Glean data. Requires Firebase Admin service account key.</p>
              <div style={{ background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontFamily: "monospace", fontSize: 12, color: "var(--text-second)" }}>
                1. Firebase console → Project Settings → Service accounts → Generate new private key{"\n"}
                2. Save as scripts/serviceAccount.json{"\n"}
                3. node scripts/seed-emea.mjs
              </div>
            </div>

            {/* Roadmap */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "20px 24px" }}>
              <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 14, marginBottom: 8 }}>🗺 Roadmap</h3>
              <ul style={{ fontSize: 13, color: "var(--text-second)", lineHeight: 2.2, listStyle: "none" }}>
                <li><span style={{ color: "var(--green)", marginRight: 8 }}>✓</span>Customer lifecycle management (7 stages)</li>
                <li><span style={{ color: "var(--green)", marginRight: 8 }}>✓</span>Data capture forms (all stages)</li>
                <li><span style={{ color: "var(--green)", marginRight: 8 }}>✓</span>Integration portfolio per customer</li>
                <li><span style={{ color: "var(--green)", marginRight: 8 }}>✓</span>Integration spec export (.docx)</li>
                <li><span style={{ color: "var(--green)", marginRight: 8 }}>✓</span>Customer dashboard with shareable view</li>
                <li><span style={{ color: "var(--green)", marginRight: 8 }}>✓</span>Role-based access (CSE / CSM / COM / AE / TA)</li>
                <li><span style={{ color: "var(--amber)", marginRight: 8 }}>◐</span>Firestore security rules (written, needs deploy)</li>
                <li><span style={{ color: "var(--amber)", marginRight: 8 }}>◐</span>EMEA data seed (needs service account key)</li>
                <li><span style={{ color: "var(--text-muted)", marginRight: 8 }}>○</span>Salesforce sync — auto-pull CS Requests</li>
                <li><span style={{ color: "var(--text-muted)", marginRight: 8 }}>○</span>Jira sync — live ticket status updates</li>
                <li><span style={{ color: "var(--text-muted)", marginRight: 8 }}>○</span>Email notifications — overdue tasks & stage advances</li>
              </ul>
            </div>
          </div>
        ) : null}
      </main>

      <EngagementModal
        open={showNewModal}
        onClose={() => setShowNewModal(false)}
        users={users}
        customers={customers}
      />
    </div>
  );
}

export default function App() {
  const hash = window.location.hash;
  // Token-based share route: #/s/:token
  const tokenMatch = hash.match(/^#\/s\/([a-z0-9]+)$/i);
  if (tokenMatch) {
    return <SharePage token={tokenMatch[1]} />;
  }
  // Legacy direct customerId route (backwards compat): #/share/:customerId
  const shareMatch = hash.match(/^#\/share\/(.+)$/);
  if (shareMatch) {
    return <SharePage customerId={shareMatch[1]} />;
  }

  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}

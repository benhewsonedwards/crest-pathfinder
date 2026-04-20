import { useAuth } from "../hooks/useAuth";
import { Avatar } from "./UI";

const NAV_ITEMS = [
  { id: "dashboard",   icon: "🏠", label: "My Dashboard" },
  { id: "customers",   icon: "🏢", label: "Customers"   },
  { id: "pipeline",    icon: "⚡", label: "Pipeline"    },
  { id: "engagements", icon: "🗂️",  label: "Engagements" },
  { id: "issues",      icon: "⚠️",  label: "Issues"      },
  { id: "team",        icon: "👥", label: "Team"         },
  { id: "sharelinks",  icon: "🔗", label: "Share Links"  },
  { id: "settings",    icon: "⚙️",  label: "Settings"    },
];

export default function Sidebar({ active, onChange }) {
  const { user, profile, logout } = useAuth();

  return (
    <div style={{
      width: 220, flexShrink: 0, height: "100vh", position: "sticky", top: 0,
      background: "var(--surface)", borderRight: "1px solid var(--border)",
      display: "flex", flexDirection: "column",
      boxShadow: "var(--shadow-sm)",
    }}>
      {/* Logo */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, #6559FF 0%, #8B80FF 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 3px 8px rgba(101,89,255,0.30)", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L4 6.5V11C4 15.1 7 18.9 11 20C15 18.9 18 15.1 18 11V6.5L11 2Z" fill="white" fillOpacity="0.9"/>
              <path d="M8 11L10 13L14 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.1 }}>CREST</p>
            <p style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600, letterSpacing: "0.07em" }}>PATHFINDER</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
        {NAV_ITEMS.map(item => {
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => onChange(item.id)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 9,
              padding: "8px 10px", borderRadius: "var(--radius-sm)",
              background: isActive ? "var(--purple-light)" : "transparent",
              border: "none", cursor: "pointer", marginBottom: 2,
              color: isActive ? "var(--purple)" : "var(--text-second)",
              fontFamily: "inherit", fontSize: 13, fontWeight: isActive ? 600 : 400,
              transition: "all 0.13s", textAlign: "left",
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--surface2)"; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div style={{ padding: "12px 12px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
          <Avatar name={user?.displayName} photoURL={user?.photoURL} size={30} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user?.displayName?.split(" ")[0]}
            </p>
            <p style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "capitalize" }}>
              {profile?.role?.replace("_", " ") || "viewer"}
            </p>
          </div>
        </div>
        <button onClick={logout} style={{
          width: "100%", padding: "6px 10px", borderRadius: "var(--radius-sm)",
          background: "transparent", border: "1px solid var(--border)",
          fontSize: 12, color: "var(--text-muted)", cursor: "pointer",
          fontFamily: "inherit", transition: "all 0.13s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--red)"; e.currentTarget.style.color = "var(--red)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

import { useState } from "react";

const S = {
  // Buttons
  btnBase: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 6, border: "none", borderRadius: "var(--radius)", fontFamily: "inherit",
    fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
    padding: "8px 16px", textDecoration: "none", whiteSpace: "nowrap",
  },
};

export function Btn({ variant = "primary", size = "md", onClick, disabled, children, style, type = "button" }) {
  const variants = {
    primary: { background: "var(--purple)", color: "#fff" },
    secondary: { background: "var(--surface2)", color: "var(--text-primary)", border: "1px solid var(--border)" },
    ghost: { background: "transparent", color: "var(--text-second)", border: "1px solid var(--border)" },
    danger: { background: "var(--red-light)", color: "var(--red)", border: "1px solid rgba(220,38,38,0.2)" },
    success: { background: "var(--green-light)", color: "var(--green)", border: "1px solid rgba(22,163,74,0.2)" },
  };
  const sizes = {
    sm: { fontSize: 12, padding: "5px 10px" },
    md: { fontSize: 13, padding: "8px 16px" },
    lg: { fontSize: 14, padding: "10px 20px" },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...S.btnBase, ...variants[variant], ...sizes[size],
      opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer",
      ...style,
    }}>
      {children}
    </button>
  );
}

export function Card({ children, style, onClick, hover = false }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => hover && setHovered(true)}
      onMouseLeave={() => hover && setHovered(false)}
      style={{
        background: "var(--surface)", borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)",
        overflow: "hidden", transition: "box-shadow 0.15s, transform 0.15s",
        ...(hover && hovered ? { boxShadow: "var(--shadow-md)", transform: "translateY(-1px)", cursor: "pointer" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style }) {
  return (
    <div style={{
      padding: "12px 18px", background: "var(--surface2)",
      borderBottom: "1px solid var(--border)", display: "flex",
      alignItems: "center", justifyContent: "space-between", ...style,
    }}>
      {children}
    </div>
  );
}

export function Label({ children, style }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.07em",
      textTransform: "uppercase", color: "var(--text-muted)", ...style,
    }}>
      {children}
    </span>
  );
}

export function Pill({ children, color = "purple", style }) {
  const colors = {
    purple: { bg: "var(--purple-light)", text: "var(--purple)" },
    green:  { bg: "var(--green-light)",  text: "var(--green)"  },
    amber:  { bg: "var(--amber-light)",  text: "var(--amber)"  },
    red:    { bg: "var(--red-light)",    text: "var(--red)"    },
    blue:   { bg: "var(--blue-light)",   text: "var(--blue)"   },
    teal:   { bg: "var(--teal-light)",   text: "var(--teal)"   },
    orange: { bg: "var(--orange-light)", text: "var(--orange)" },
    slate:  { bg: "var(--slate-light)",  text: "var(--slate)"  },
    grey:   { bg: "var(--surface2)",     text: "var(--text-second)" },
  };
  const c = colors[color] || colors.grey;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: c.bg, color: c.text, ...style,
    }}>
      {children}
    </span>
  );
}

export function Avatar({ name, photoURL, size = 32, style }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const colors = ["#6559FF","#0EA5E9","#16A34A","#D97706","#DC2626","#0D9488","#7C3AED","#DB2777"];
  const colorIdx = name ? name.charCodeAt(0) % colors.length : 0;
  if (photoURL) return (
    <img src={photoURL} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, ...style }} />
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: colors[colorIdx] + "20", color: colors[colorIdx],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "Poppins, sans-serif", fontWeight: 700,
      fontSize: size * 0.35, ...style,
    }}>
      {initials}
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = "text", style, disabled }) {
  return (
    <input
      type={type} value={value} onChange={onChange}
      placeholder={placeholder} disabled={disabled}
      style={{
        width: "100%", padding: "8px 12px", fontSize: 13,
        border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
        background: "var(--surface)", color: "var(--text-primary)",
        fontFamily: "inherit", outline: "none", transition: "border-color 0.15s",
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = "var(--purple)"}
      onBlur={e => e.target.style.borderColor = "var(--border)"}
    />
  );
}

export function Select({ value, onChange, children, style, disabled }) {
  return (
    <select
      value={value} onChange={onChange} disabled={disabled}
      style={{
        width: "100%", padding: "8px 12px", fontSize: 13,
        border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
        background: "var(--surface)", color: "var(--text-primary)",
        fontFamily: "inherit", outline: "none", cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </select>
  );
}

export function Textarea({ value, onChange, placeholder, rows = 3, style }) {
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{
        width: "100%", padding: "8px 12px", fontSize: 13,
        border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
        background: "var(--surface)", color: "var(--text-primary)",
        fontFamily: "inherit", outline: "none", resize: "vertical",
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = "var(--purple)"}
      onBlur={e => e.target.style.borderColor = "var(--border)"}
    />
  );
}

export function Modal({ open, onClose, title, children, width = 560 }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: "var(--surface)", borderRadius: "var(--radius-xl)",
        width: "100%", maxWidth: width, boxShadow: "var(--shadow-lg)",
        maxHeight: "90vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "18px 22px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 15 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--text-muted)", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange, style }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid var(--border)", gap: 2, ...style }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          padding: "8px 16px", fontSize: 13, cursor: "pointer",
          background: "none", border: "none", borderBottom: `2px solid ${active === t.id ? "var(--purple)" : "transparent"}`,
          color: active === t.id ? "var(--purple)" : "var(--text-second)",
          fontWeight: active === t.id ? 600 : 400, fontFamily: "inherit",
          transition: "all 0.15s", marginBottom: -1,
          display: "flex", alignItems: "center", gap: 6,
        }}>
          {t.label}
          {t.badge != null && (
            <span style={{
              background: active === t.id ? "var(--purple-light)" : "var(--surface2)",
              color: active === t.id ? "var(--purple)" : "var(--text-muted)",
              borderRadius: 999, padding: "1px 6px", fontSize: 10, fontWeight: 700,
            }}>{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
      <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>{title}</p>
      {description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>{description}</p>}
      {action}
    </div>
  );
}

export function Spinner({ size = 20 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: `2px solid var(--border)`,
      borderTopColor: "var(--purple)",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

export function FieldGroup({ label, children, required, style }) {
  return (
    <div style={{ marginBottom: 14, ...style }}>
      {label && (
        <div style={{ marginBottom: 5, display: "flex", alignItems: "center", gap: 4 }}>
          <Label>{label}</Label>
          {required && <span style={{ color: "var(--red)", fontSize: 11 }}>*</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// Inject spin + toast keyframes
const styleEl = document.createElement("style");
styleEl.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes toastOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(12px); } }
`;
document.head.appendChild(styleEl);

// ─── Toast ────────────────────────────────────────────────────────────────────
import { useState as _useState, useCallback as _useCallback, useRef as _useRef, useEffect as _useEffect } from "react";

export function useToast() {
  const [toasts, setToasts] = _useState([]);
  const idRef = _useRef(0);

  const toast = _useCallback((message, type = "success", duration = 3000) => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, message, type, leaving: false }]);
    setTimeout(() => {
      setToasts(t => t.map(x => x.id === id ? { ...x, leaving: true } : x));
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 300);
    }, duration);
  }, []);

  return { toasts, toast };
}

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      display: "flex", flexDirection: "column", gap: 8,
      zIndex: 9999, pointerEvents: "none",
    }}>
      {toasts.map(t => {
        const colours = {
          success: { bg: "var(--green)", text: "white" },
          error:   { bg: "var(--red)",   text: "white" },
          info:    { bg: "var(--purple)", text: "white" },
        };
        const c = colours[t.type] || colours.info;
        return (
          <div key={t.id} style={{
            background: c.bg, color: c.text,
            padding: "10px 16px", borderRadius: "var(--radius)",
            fontSize: 13, fontWeight: 500, fontFamily: "'Noto Sans', sans-serif",
            boxShadow: "var(--shadow-lg)",
            animation: `${t.leaving ? "toastOut" : "toastIn"} 0.25s ease`,
            display: "flex", alignItems: "center", gap: 8, maxWidth: 340,
          }}>
            <span>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

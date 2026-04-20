import { useState, useRef, useEffect } from "react";
import { peopleForField } from "../lib/people";

/**
 * PersonSelect — a searchable dropdown for selecting a person from the directory.
 *
 * Props:
 *   field        "csm" | "com" | "ae" | "cse" | "owner" | "all"
 *   value        current selected email (string) or "" for none
 *   onChange     (email: string) => void  — passes email of selected person, or "" to clear
 *   placeholder  string
 *   label        optional label text (renders above the selector)
 *   style        optional extra style on the outer container
 */
export default function PersonSelect({ field = "all", value, onChange, placeholder = "Select person...", label, style }) {
  const people = peopleForField(field);
  const selected = people.find(p => p.email === value) || null;

  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const inputRef            = useRef(null);
  const containerRef        = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handler(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const filtered = query.trim()
    ? people.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.role.toLowerCase().includes(query.toLowerCase()) ||
        p.title.toLowerCase().includes(query.toLowerCase())
      )
    : people;

  function select(person) {
    onChange(person.email);
    setOpen(false);
    setQuery("");
  }

  function clear(e) {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    setQuery("");
  }

  // Role colour mapping
  const roleColour = {
    cse:     "var(--purple)",
    com:     "#00BCD4",
    im:      "#7C4DFF",
    csm:     "var(--green)",
    ae:      "var(--amber)",
    manager: "var(--text-muted)",
  };

  return (
    <div ref={containerRef} style={{ position: "relative", ...style }}>
      {label && (
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 5 }}>
          {label}
        </p>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", textAlign: "left",
          background: "var(--surface2)", color: selected ? "var(--text-primary)" : "var(--text-muted)",
          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
          padding: "8px 32px 8px 10px", fontSize: 13, fontFamily: "inherit",
          cursor: "pointer", position: "relative", transition: "border-color 0.15s",
          display: "flex", alignItems: "center", gap: 8,
          ...(open ? { borderColor: "var(--purple)" } : {}),
        }}
      >
        {selected ? (
          <>
            <span style={{
              width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
              background: (roleColour[selected.roleKey] || "var(--purple)") + "25",
              color: roleColour[selected.roleKey] || "var(--purple)",
              fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {selected.initials}
            </span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.name}
            </span>
            <span style={{
              fontSize: 10, color: roleColour[selected.roleKey] || "var(--purple)",
              background: (roleColour[selected.roleKey] || "var(--purple)") + "18",
              borderRadius: 4, padding: "1px 5px", flexShrink: 0,
            }}>
              {selected.roleKey.toUpperCase()}
            </span>
          </>
        ) : (
          <span style={{ flex: 1 }}>{placeholder}</span>
        )}
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "var(--text-muted)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Clear button */}
      {selected && !open && (
        <button
          type="button"
          onClick={clear}
          style={{
            position: "absolute", right: 26, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", fontSize: 12, padding: "2px 4px", lineHeight: 1,
            ...(label ? { top: "calc(50% + 10px)" } : {}),
          }}
          title="Clear"
        >✕</button>
      )}

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          zIndex: 500, background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", boxShadow: "var(--shadow-md)",
          maxHeight: 260, display: "flex", flexDirection: "column",
        }}>
          {/* Search box */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or role..."
              style={{
                width: "100%", background: "var(--surface2)", color: "var(--text-primary)",
                border: "1px solid var(--border)", borderRadius: 6,
                padding: "6px 10px", fontSize: 12, fontFamily: "inherit", outline: "none",
              }}
              onFocus={e => e.target.style.borderColor = "var(--purple)"}
              onBlur={e => e.target.style.borderColor = "var(--border)"}
            />
          </div>

          {/* Options list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", padding: "12px 14px", textAlign: "center" }}>
                No matches
              </p>
            )}
            {/* Group by role */}
            {["cse", "com", "im", "csm", "ae", "manager"].map(rk => {
              const group = filtered.filter(p => p.roleKey === rk);
              if (!group.length) return null;
              const roleLabel = { cse: "CSE", com: "COM", im: "IM", csm: "CSM", ae: "AE", manager: "Manager" }[rk];
              return (
                <div key={rk}>
                  <div style={{
                    padding: "5px 10px 3px", fontSize: 10, fontWeight: 700,
                    letterSpacing: "0.06em", textTransform: "uppercase",
                    color: roleColour[rk] || "var(--text-muted)",
                    background: (roleColour[rk] || "var(--text-muted)") + "08",
                    borderBottom: "1px solid var(--border)",
                  }}>
                    {roleLabel}
                  </div>
                  {group.map(person => (
                    <button
                      key={person.email}
                      type="button"
                      onClick={() => select(person)}
                      style={{
                        width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
                        padding: "8px 12px", fontSize: 13, background: person.email === value ? "var(--purple-light)" : "transparent",
                        border: "none", cursor: "pointer", fontFamily: "inherit",
                        color: "var(--text-primary)", transition: "background 0.1s",
                        borderBottom: "1px solid var(--border)",
                      }}
                      onMouseEnter={e => { if (person.email !== value) e.currentTarget.style.background = "var(--surface2)"; }}
                      onMouseLeave={e => { if (person.email !== value) e.currentTarget.style.background = "transparent"; }}
                    >
                      <span style={{
                        width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                        background: (roleColour[rk] || "var(--purple)") + "25",
                        color: roleColour[rk] || "var(--purple)",
                        fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {person.initials}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: person.email === value ? 600 : 400, margin: 0, lineHeight: 1.3 }}>
                          {person.name}
                        </p>
                        <p style={{ fontSize: 10, color: "var(--text-muted)", margin: 0, lineHeight: 1.3 }}>
                          {person.location}
                        </p>
                      </div>
                      {person.email === value && (
                        <span style={{ fontSize: 14, color: roleColour[rk] || "var(--purple)", flexShrink: 0 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

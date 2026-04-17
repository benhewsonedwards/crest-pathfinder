import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Spinner } from "../components/UI";

export default function LoginPage() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      await login();
    } catch (err) {
      if (err.code === "auth/popup-closed-by-user") {
        setError(null);
      } else if (err.code === "auth/unauthorized-domain") {
        setError("This domain is not authorised. Please contact your administrator.");
      } else {
        setError("Sign-in failed. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "linear-gradient(135deg, #F0F1FF 0%, #F5F7FB 50%, #EFF6FF 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      {/* Background decoration */}
      <div style={{
        position: "fixed", top: -80, right: -80, width: 360, height: 360,
        borderRadius: "50%", background: "rgba(101,89,255,0.07)", pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: -60, left: -60, width: 280, height: 280,
        borderRadius: "50%", background: "rgba(14,165,233,0.06)", pointerEvents: "none",
      }} />

      <div style={{
        background: "#fff", borderRadius: 24, padding: "44px 48px",
        width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
        textAlign: "center", position: "relative",
      }}>
        {/* Logo mark */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #6559FF 0%, #8B80FF 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(101,89,255,0.35)",
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L4 6.5V11C4 15.1 7 18.9 11 20C15 18.9 18 15.1 18 11V6.5L11 2Z" fill="white" fillOpacity="0.9"/>
              <path d="M8 11L10 13L14 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ textAlign: "left" }}>
            <p style={{ fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 18, color: "#111827", lineHeight: 1.1 }}>CREST</p>
            <p style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 500, letterSpacing: "0.06em" }}>PATHFINDER</p>
          </div>
        </div>

        <h1 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 600, fontSize: 22, color: "#111827", marginBottom: 8 }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 32, lineHeight: 1.6 }}>
          Sign in with your SafetyCulture Google account to continue
        </p>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%", padding: "12px 20px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            background: loading ? "#F3F4F6" : "#fff",
            border: "1.5px solid #E5E7EB", borderRadius: 10,
            fontSize: 14, fontWeight: 600, fontFamily: "inherit",
            color: "#111827", cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.borderColor = "#6559FF"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; }}
        >
          {loading ? (
            <Spinner size={18} />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
              <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>

        {error && (
          <div style={{
            marginTop: 16, padding: "10px 14px", background: "#FEE2E2",
            borderRadius: 8, fontSize: 12, color: "#DC2626",
          }}>
            {error}
          </div>
        )}

        <p style={{ marginTop: 24, fontSize: 11, color: "#9CA3AF" }}>
          Restricted to @safetyculture.io accounts
        </p>
      </div>
    </div>
  );
}

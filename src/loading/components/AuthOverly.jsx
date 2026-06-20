import AuthRing from "./AuthRing";

export default function AuthOverlay({ message }) {
  return (
    <div className="alv-auth-overlay">
      <div className="alv-auth-brand">Aliver <span>Bio</span>Pharma</div>
      <AuthRing size={64} />
      <p className="alv-auth-msg">{message || "Authenticating…"}</p>
    </div>
  );
}

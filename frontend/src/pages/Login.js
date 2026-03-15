import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api";

function Login({ onAuth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await login(email, password);
      onAuth(data.user);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">קנסיק</h1>
        <h2 className="auth-title">התחברות</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label>סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="הזן סיסמה"
              dir="rtl"
              autoComplete="current-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !email.trim() || !password.trim()}
          >
            {loading ? "מתחבר..." : "התחבר"}
          </button>
        </form>

        <p className="auth-switch">
          אין לך חשבון?{" "}
          <span onClick={() => navigate("/register")}>הרשמה</span>
        </p>
      </div>
    </div>
  );
}

export default Login;

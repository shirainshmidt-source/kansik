import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../api";

function Register({ onAuth }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) return;

    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await register(email, password, name);
      onAuth(data.user);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(detail || "שגיאה בהרשמה");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">קנסיק</h1>
        <h2 className="auth-title">הרשמה</h2>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label>שם מלא</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="השם שלך"
              dir="rtl"
              autoComplete="name"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label>אימייל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label>סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="לפחות 6 תווים"
              dir="rtl"
              autoComplete="new-password"
            />
          </div>

          {error && <p className="auth-error">{error}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !name.trim() || !email.trim() || !password.trim()}
          >
            {loading ? "נרשם..." : "הרשמה"}
          </button>
        </form>

        <p className="auth-switch">
          יש לך חשבון?{" "}
          <span onClick={() => navigate("/login")}>התחברות</span>
        </p>
      </div>
    </div>
  );
}

export default Register;

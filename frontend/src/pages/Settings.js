import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getReminderSettings, updateReminderSettings } from "../api";

const APPEAL_OPTIONS = [
  { value: 7, label: "7 ימים לפני" },
  { value: 3, label: "3 ימים לפני" },
  { value: 1, label: "יום לפני" },
  { value: 0, label: "ביום האחרון" },
];

const PAYMENT_OPTIONS = [
  { value: 7, label: "7 ימים לפני" },
  { value: 3, label: "3 ימים לפני" },
  { value: 1, label: "יום לפני" },
  { value: 0, label: "ביום האחרון" },
];

function Settings() {
  const navigate = useNavigate();
  const [appealDays, setAppealDays] = useState([7, 3, 1, 0]);
  const [paymentDays, setPaymentDays] = useState([7, 3, 1, 0]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getReminderSettings()
      .then((settings) => {
        setAppealDays(settings.appeal || [7, 3, 1, 0]);
        setPaymentDays(settings.payment || [7, 3, 1, 0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function toggleDay(current, setCurrent, value) {
    if (current.includes(value)) {
      setCurrent(current.filter((d) => d !== value));
    } else {
      setCurrent([...current, value]);
    }
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateReminderSettings({ appeal: appealDays, payment: paymentDays });
      setSaved(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    } catch (e) {
      // ignore
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>טוען...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", paddingBottom: 40 }}>
      <button className="back-btn" onClick={() => navigate("/")}>
        &rarr; חזרה
      </button>

      <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "#1b2a4a", margin: "16px 0 24px" }}>
        הגדרות תזכורות
      </h2>

      {/* תזכורות ערעור */}
      <div style={{
        background: "white",
        border: "1px solid #e8ecf2",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 16,
      }}>
        <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1b2a4a", margin: "0 0 4px" }}>
          תזכורות ערעור
        </p>
        <p style={{ fontSize: "0.8rem", color: "#8893a7", margin: "0 0 16px" }}>
          מתי לקבל תזכורת לפני דדליין ערעור
        </p>

        {APPEAL_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid #f0f2f5",
              cursor: "pointer",
              fontSize: "0.9rem",
              color: "#1b2a4a",
            }}
          >
            <span>{opt.label}</span>
            <div
              onClick={() => toggleDay(appealDays, setAppealDays, opt.value)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: appealDays.includes(opt.value) ? "#185FA5" : "#ddd",
                position: "relative",
                transition: "background 0.2s",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <div style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "white",
                position: "absolute",
                top: 2,
                transition: "left 0.2s, right 0.2s",
                ...(appealDays.includes(opt.value) ? { left: 2 } : { left: 22 }),
              }} />
            </div>
          </label>
        ))}
      </div>

      {/* תזכורות תשלום */}
      <div style={{
        background: "white",
        border: "1px solid #e8ecf2",
        borderRadius: 12,
        padding: "18px 20px",
        marginBottom: 24,
      }}>
        <p style={{ fontSize: "0.95rem", fontWeight: 600, color: "#1b2a4a", margin: "0 0 4px" }}>
          תזכורות תשלום
        </p>
        <p style={{ fontSize: "0.8rem", color: "#8893a7", margin: "0 0 16px" }}>
          מתי לקבל תזכורת לפני דדליין תשלום
        </p>

        {PAYMENT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid #f0f2f5",
              cursor: "pointer",
              fontSize: "0.9rem",
              color: "#1b2a4a",
            }}
          >
            <span>{opt.label}</span>
            <div
              onClick={() => toggleDay(paymentDays, setPaymentDays, opt.value)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: paymentDays.includes(opt.value) ? "#185FA5" : "#ddd",
                position: "relative",
                transition: "background 0.2s",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <div style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "white",
                position: "absolute",
                top: 2,
                transition: "left 0.2s, right 0.2s",
                ...(paymentDays.includes(opt.value) ? { left: 2 } : { left: 22 }),
              }} />
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: "100%",
          padding: "14px 24px",
          background: "#185FA5",
          color: "white",
          border: "none",
          borderRadius: 10,
          fontSize: "1rem",
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "שומר..." : "שמור הגדרות"}
      </button>

      {saved && (
        <div style={{
          textAlign: "center",
          color: "#0d8a3f",
          background: "#eefbf3",
          border: "1px solid #b6e5c8",
          borderRadius: 10,
          padding: "12px",
          marginTop: 12,
          fontSize: "0.9rem",
          fontWeight: 600,
        }}>
          ההגדרות נשמרו בהצלחה
        </div>
      )}
    </div>
  );
}

export default Settings;

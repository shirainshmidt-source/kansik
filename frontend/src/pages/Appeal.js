import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTicket, createAppeal, reviseAppeal, updateTicket } from "../api";

function Appeal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [reason, setReason] = useState("");
  const [appealText, setAppealText] = useState("");
  const [correction, setCorrection] = useState("");
  const [showCorrection, setShowCorrection] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("input"); // input | result

  useEffect(() => {
    getTicket(id).then(setTicket);
  }, [id]);

  async function handleGenerate() {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      const { appeal_text } = await createAppeal(id, reason);
      setAppealText(appeal_text);
      setStep("result");
    } catch {
      alert("שגיאה בניסוח הערעור");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevise() {
    if (!correction.trim()) return;
    setLoading(true);
    try {
      const { appeal_text } = await reviseAppeal(id, appealText, correction);
      setAppealText(appeal_text);
      setCorrection("");
      setShowCorrection(false);
    } catch {
      alert("שגיאה בתיקון הערעור");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(appealText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  async function handleMarkAppealed() {
    await updateTicket(id, { status: "appealed" });
    navigate("/");
  }

  function handleStartOver() {
    setAppealText("");
    setReason("");
    setCopied(false);
    setStep("input");
  }

  if (!ticket) {
    return (
      <div className="loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="appeal-page">
      <button className="back-btn" onClick={() => navigate(`/ticket/${id}`)}>
        → חזרה לדוח
      </button>

      <h2 style={{ margin: "16px 0" }}>ערעור על דוח</h2>
      <p style={{ color: "#666", marginBottom: 24 }}>
        {ticket.municipality} • דוח {ticket.ticket_number} • ₪
        {ticket.amount_updated || ticket.amount_original}
      </p>

      {step === "input" && (
        <>
          <div className="appeal-input">
            <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
              ספר בקצרה למה מגיע לך לערער:
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='למשל: "לא היה שלט חניה" או "הפרקומט לא עבד"'
              rows={3}
            />
          </div>

          <button
            className="btn-primary"
            onClick={handleGenerate}
            disabled={!reason.trim() || loading}
          >
            {loading ? "מנסח ערעור..." : "נסח ערעור"}
          </button>

          {loading && (
            <div className="loading" style={{ marginTop: 20 }}>
              <div className="spinner" />
              <p>AI מנסח ערעור מקצועי...</p>
            </div>
          )}
        </>
      )}

      {step === "result" && (
        <>
          <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
            טקסט הערעור (ניתן לערוך ידנית):
          </label>
          <textarea
            className="appeal-result-edit"
            value={appealText}
            onChange={(e) => setAppealText(e.target.value)}
            rows={12}
          />

          <div className="appeal-actions">
            <button
              className={copied ? "btn-success" : "btn-primary"}
              onClick={handleCopy}
            >
              {copied ? "הועתק!" : "העתק ערעור"}
            </button>

            {ticket.appeal_url && (
              <a href={ticket.appeal_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button className="btn-primary" style={{ width: "100%", background: "#16a34a" }}>
                  עבור לאתר העירייה לשליחת ערעור
                </button>
              </a>
            )}

            <button
              className="btn-secondary"
              onClick={() => setShowCorrection(!showCorrection)}
            >
              בקש תיקון מ-AI
            </button>

            {showCorrection && (
              <div className="revision-input">
                <input
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  placeholder="מה לתקן?"
                  onKeyDown={(e) => e.key === "Enter" && handleRevise()}
                />
                <button
                  className="btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={handleRevise}
                  disabled={!correction.trim() || loading}
                >
                  {loading ? "מתקן..." : "תקן"}
                </button>
              </div>
            )}

            <button className="btn-secondary" onClick={handleStartOver}>
              התחל מחדש
            </button>

            <hr style={{ border: "none", borderTop: "1px solid #e0e0e0", margin: "8px 0" }} />

            <button className="btn-success" onClick={handleMarkAppealed}>
              שלחתי את הערעור - סמן כ"בערעור"
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Appeal;

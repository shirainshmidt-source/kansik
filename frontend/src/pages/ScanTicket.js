import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { scanTicket, createTicket } from "../api";

const FIELD_LABELS = {
  ticket_type: "סוג דוח",
  municipality: "גורם מנפיק",
  ticket_number: "מספר דוח",
  violation_date: "תאריך עבירה",
  vehicle_plate: "מספר רכב",
  violation_description: "תיאור העבירה",
  location: "מיקום",
  amount_original: "סכום מקורי (₪)",
  amount_updated: "סכום עדכני (₪)",
  payment_deadline: "תשלום עד",
  appeal_deadline: "ערעור עד",
  court_deadline: "הישפטות עד",
  payment_url: "קישור תשלום",
  appeal_url: "קישור ערעור",
  court_url: "קישור הישפטות",
  notes: "הערות",
};

function ScanTicket() {
  const [frontImage, setFrontImage] = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backImage, setBackImage] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [scanResult, setScanResult] = useState(null);
  const [editedData, setEditedData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const frontRef = useRef();
  const backRef = useRef();
  const navigate = useNavigate();

  function handleFrontSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFrontImage(file);
    setFrontPreview(URL.createObjectURL(file));
    setScanResult(null);
    setEditedData(null);
    setError(null);
  }

  function handleBackSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBackImage(file);
    setBackPreview(URL.createObjectURL(file));
    setScanResult(null);
    setEditedData(null);
    setError(null);
  }

  function removeBack() {
    setBackImage(null);
    setBackPreview(null);
  }

  async function handleScan() {
    if (!frontImage) return;
    setScanning(true);
    setError(null);
    try {
      const result = await scanTicket(frontImage, backImage);
      setScanResult(result);
      setEditedData({ ...result });
    } catch (err) {
      setError("שגיאה בסריקה. נסי שוב.");
    } finally {
      setScanning(false);
    }
  }

  function handleFieldChange(field, value) {
    setEditedData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const ticket = await createTicket(editedData);
      navigate(`/ticket/${ticket.id}`);
    } catch (err) {
      setError("שגיאה בשמירה. נסי שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="scan-page">
      <button className="back-btn" onClick={() => window.location.href = "/"}>
        → חזרה
      </button>

      <h2 style={{ margin: "16px 0" }}>סריקת דוח חדש</h2>

      <p style={{ fontSize: "0.85rem", color: "#666", marginBottom: 16, textAlign: "right" }}>
        צלמי את הדוח בצורה ברורה ושטוחה לדיוק מירבי
      </p>

      {/* חזית */}
      <input
        type="file"
        accept="image/*"
        ref={frontRef}
        style={{ display: "none" }}
        onChange={handleFrontSelect}
      />

      <div
        className={`upload-area ${frontPreview ? "has-image" : ""}`}
        onClick={() => frontRef.current.click()}
      >
        {frontPreview ? (
          <>
            <img src={frontPreview} alt="חזית הדוח" />
            <p style={{ marginTop: 8, fontSize: "0.85rem", color: "#4361ee" }}>חזית הדוח (לחצי להחלפה)</p>
          </>
        ) : (
          <>
            <div className="icon">📷</div>
            <p>חזית הדוח</p>
            <p style={{ fontSize: "0.8rem", color: "#999", marginTop: 4 }}>לחצי לצילום או העלאה</p>
          </>
        )}
      </div>

      {/* גב */}
      <input
        type="file"
        accept="image/*"
        ref={backRef}
        style={{ display: "none" }}
        onChange={handleBackSelect}
      />

      {frontPreview && (
        <div
          className={`upload-area ${backPreview ? "has-image" : ""}`}
          style={{ marginTop: 12, padding: backPreview ? 20 : 30, borderColor: backPreview ? "#4361ee" : "#ddd" }}
          onClick={() => backRef.current.click()}
        >
          {backPreview ? (
            <>
              <img src={backPreview} alt="גב הדוח" />
              <div style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center" }}>
                <span style={{ fontSize: "0.85rem", color: "#4361ee" }}>גב הדוח (לחצי להחלפה)</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeBack(); }}
                  style={{ fontSize: "0.8rem", padding: "2px 10px", background: "#fee2e2", color: "#dc2626" }}
                >
                  הסר
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ color: "#888", fontSize: "0.9rem" }}>גב הדוח (אופציונלי)</p>
              <p style={{ fontSize: "0.8rem", color: "#aaa", marginTop: 4 }}>
                מומלץ! קישורים לתשלום וערעור מופיעים לעיתים בגב
              </p>
            </>
          )}
        </div>
      )}

      {frontImage && !scanResult && (
        <button
          className="btn-primary"
          style={{ marginTop: 16 }}
          onClick={handleScan}
          disabled={scanning}
        >
          {scanning ? "סורק..." : "סרוק דוח"}
        </button>
      )}

      {scanning && (
        <div className="loading" style={{ marginTop: 20 }}>
          <div className="spinner" />
          <p>AI מנתח את הדוח{backImage ? " (שני צדדים)" : ""}...</p>
        </div>
      )}

      {error && (
        <p style={{ color: "#dc2626", marginTop: 16 }}>{error}</p>
      )}

      {editedData && (
        <div className="scan-results">
          <h3>פרטים שזוהו - בדקי ותקני</h3>

          {(!editedData.payment_url && !editedData.appeal_url && !editedData.court_url) && (
            <div style={{
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              borderRadius: 12,
              padding: 16,
              margin: "16px 0",
              fontSize: "0.9rem",
              lineHeight: 1.6,
            }}>
              <p style={{ fontWeight: 600, color: "#92400e" }}>
                לא נמצאו קישורים לתשלום, ערעור או הישפטות
              </p>
              <p style={{ color: "#92400e", marginTop: 4 }}>
                {!backImage
                  ? <>שקלי לצלם גם את <strong>גב הדוח</strong> - לעיתים הקישורים מופיעים שם. אפשר גם להוסיף ידנית למטה.</>
                  : <>אפשר להוסיף קישורים ידנית בשדות למטה.</>
                }
              </p>
            </div>
          )}

          {Object.entries(FIELD_LABELS).map(([field, label]) => (
            <div className="field-row" key={field}>
              <span className="label">{label}</span>
              <input
                style={{ width: "55%", textAlign: "left" }}
                value={editedData[field] || ""}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                placeholder="-"
              />
            </div>
          ))}

          <button
            className="btn-success"
            style={{ marginTop: 24 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "שומר..." : "אישור ושמירה"}
          </button>
        </div>
      )}
    </div>
  );
}

export default ScanTicket;

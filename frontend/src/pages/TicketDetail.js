import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTicket, updateTicket, deleteTicket } from "../api";

function DeadlineAlert({ label, days }) {
  if (days === null || days === undefined) return null;

  let color, bg, icon, text;

  if (days < 0) {
    color = "#a8261e";
    bg = "#fef1f1";
    icon = "!!";
    text = `עבר הזמן ל${label} (לפני ${Math.abs(days)} ימים)`;
  } else if (days === 0) {
    color = "#dc3545";
    bg = "#fef1f1";
    icon = "!!";
    text = `היום יום אחרון ל${label}!`;
  } else if (days <= 3) {
    color = "#dc3545";
    bg = "#fef1f1";
    icon = "!";
    text = `נשארו ${days} ימים ל${label}`;
  } else if (days <= 7) {
    color = "#c27a00";
    bg = "#fff8eb";
    icon = "!";
    text = `נשארו ${days} ימים ל${label}`;
  } else {
    color = "#0d8a3f";
    bg = "#eefbf3";
    icon = "V";
    text = `נשארו ${days} ימים ל${label}`;
  }

  return (
    <div
      style={{
        background: bg,
        color: color,
        borderRadius: 10,
        padding: "10px 14px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontWeight: 600,
        fontSize: "0.9rem",
      }}
    >
      <span>{text}</span>
      <span style={{
        background: color,
        color: "white",
        borderRadius: "50%",
        width: 24,
        height: 24,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.7rem",
        flexShrink: 0,
      }}>
        {icon}
      </span>
    </div>
  );
}

function estimateOverdueAmount(originalAmount, daysOverdue) {
  let amount = originalAmount * 1.5;
  const daysAfterInitial = Math.max(0, daysOverdue - 90);
  const halfYears = Math.floor(daysAfterInitial / 180);
  amount = amount * Math.pow(1.05, halfYears);
  return Math.round(amount);
}

function AmountDisplay({ ticket }) {
  const isOverdue = ticket.days_until_payment !== null && ticket.days_until_payment < 0;
  const noUpdatedAmount = !ticket.amount_updated;

  if (isOverdue && noUpdatedAmount && ticket.amount_original) {
    const daysOverdue = Math.abs(ticket.days_until_payment);
    const estimated = estimateOverdueAmount(ticket.amount_original, daysOverdue);
    const hasInitialSurcharge = daysOverdue >= 90;
    const halfYears = Math.floor(Math.max(0, daysOverdue - 90) / 180);

    return (
      <div style={{
        background: "#fef1f1",
        border: "1px solid #fca5a5",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
      }}>
        <span style={{ fontSize: "1rem", textDecoration: "line-through", color: "#999" }}>
          ₪{ticket.amount_original.toLocaleString()}
        </span>
        <p style={{ color: "#dc3545", fontWeight: 700, fontSize: "1.3rem", marginTop: 4 }}>
          ~₪{estimated.toLocaleString()}
        </p>
        <p style={{ color: "#555", fontSize: "0.82rem", marginTop: 6, lineHeight: 1.6 }}>
          {hasInitialSurcharge && <>+50% תוספת פיגורים ראשונית (אחרי 90 יום)<br /></>}
          {halfYears > 0 && <>+5% ריבית לכל חצי שנה ({halfYears} תקופות)<br /></>}
          {!hasInitialSurcharge && <>איחור של {daysOverdue} ימים - תוספת 50% צפויה אחרי 90 יום<br /></>}
        </p>
        <p style={{ color: "#a8261e", fontSize: "0.82rem", marginTop: 4, fontWeight: 600 }}>
          * הערכה בלבד. הסכום המדויק עשוי להשתנות - מומלץ לבדוק באתר העירייה.
        </p>
      </div>
    );
  }

  return (
    <p style={{ fontSize: "1.3rem", fontWeight: 700, color: "#dc3545" }}>
      ₪{(ticket.amount_updated || ticket.amount_original || 0).toLocaleString()}
      {ticket.amount_updated && ticket.amount_original && ticket.amount_updated > ticket.amount_original && (
        <span style={{ fontSize: "0.85rem", color: "#999", fontWeight: 400, marginRight: 8, textDecoration: "line-through" }}>
          ₪{ticket.amount_original.toLocaleString()}
        </span>
      )}
    </p>
  );
}

const ALL_FIELDS = [
  { key: "municipality", label: "גורם מנפיק" },
  { key: "ticket_number", label: "מספר דוח" },
  { key: "violation_date", label: "תאריך עבירה" },
  { key: "vehicle_plate", label: "מספר רכב" },
  { key: "violation_description", label: "עבירה" },
  { key: "location", label: "מיקום" },
  { key: "amount_original", label: "סכום מקורי (₪)" },
  { key: "amount_updated", label: "סכום עדכני (₪)" },
  { key: "payment_deadline", label: "תשלום עד" },
  { key: "appeal_deadline", label: "ערעור עד" },
  { key: "court_deadline", label: "הישפטות עד" },
  { key: "payment_url", label: "קישור תשלום" },
  { key: "appeal_url", label: "קישור ערעור" },
  { key: "court_url", label: "קישור הישפטות" },
  { key: "notes", label: "הערות" },
];

function NotesSection({ notes }) {
  const [open, setOpen] = useState(false);

  if (!notes) return null;

  // פיצול ההערות לשורות נפרדות לפי נקודות, פסיקים או ירידות שורה
  const lines = notes
    .split(/[.\n]/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "#f0f2f5",
          color: "#1b2a4a",
          width: "100%",
          padding: "12px 16px",
          borderRadius: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "0.9rem",
          fontWeight: 600,
        }}
      >
        <span>הערות נוספות</span>
        <span style={{ fontSize: "0.8rem", color: "#8893a7" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div style={{
          background: "white",
          border: "1px solid #e8ecf2",
          borderTop: "none",
          borderRadius: "0 0 10px 10px",
          padding: "14px 16px",
        }}>
          {lines.map((line, i) => (
            <div
              key={i}
              style={{
                padding: "8px 0",
                borderBottom: i < lines.length - 1 ? "1px solid #f0f2f5" : "none",
                fontSize: "0.85rem",
                color: "#3d4f6f",
                lineHeight: 1.5,
              }}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TicketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    getTicket(id)
      .then(setTicket)
      .catch(() => navigate("/"))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  async function handleMarkPaid() {
    const updated = await updateTicket(id, { status: "paid" });
    setTicket(updated);
  }

  async function handleDelete() {
    if (window.confirm("למחוק את הדוח?")) {
      await deleteTicket(id);
      navigate("/");
    }
  }

  function startEditing() {
    const data = {};
    ALL_FIELDS.forEach(({ key }) => {
      data[key] = ticket[key] || "";
    });
    setEditData(data);
    setEditing(true);
  }

  async function saveEditing() {
    const updates = {};
    ALL_FIELDS.forEach(({ key }) => {
      const val = editData[key];
      updates[key] = val === "" ? null : val;
    });
    const updated = await updateTicket(id, updates);
    setTicket(updated);
    setEditing(false);
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>טוען...</p>
      </div>
    );
  }

  if (!ticket) return null;

  const typeLabel = ticket.ticket_type === "police" ? "דוח משטרה" : ticket.ticket_type === "municipal" ? "דוח עירייה (חניה)" : null;

  return (
    <div className="ticket-detail">
      <button className="back-btn" onClick={() => navigate("/")}>
        → חזרה
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0" }}>
        <h2>{ticket.municipality || "דוח"}</h2>
        {!editing && (
          <button className="btn-secondary" style={{ padding: "6px 16px", fontSize: "0.85rem" }} onClick={startEditing}>
            עריכה
          </button>
        )}
      </div>

      {/* סכום */}
      <AmountDisplay ticket={ticket} />

      <div className="alerts-section">
        <DeadlineAlert label="תשלום בלי ריבית" days={ticket.days_until_payment} />
        <DeadlineAlert label="ערעור" days={ticket.days_until_appeal} />
        {ticket.appeal_deadline_estimated && ticket.days_until_appeal !== null && ticket.days_until_appeal >= 0 && (
          <p style={{ fontSize: "0.75rem", color: "#8893a7", marginTop: -4, paddingRight: 4 }}>
            * תאריך ערעור משוער - מומלץ לפעול יום-יומיים לפני
          </p>
        )}
        <DeadlineAlert label="בקשה להישפט" days={ticket.days_until_court} />
      </div>

      {/* מצב עריכה */}
      {editing ? (
        <div style={{ marginTop: 20 }}>
          {ALL_FIELDS.map(({ key, label }) => (
            <div className="field-row" key={key}>
              <span className="label">{label}</span>
              <input
                style={{ width: "55%", textAlign: "left", fontSize: "0.85rem" }}
                value={editData[key] || ""}
                onChange={(e) => setEditData((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder="-"
                dir={key.includes("url") ? "ltr" : "rtl"}
              />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={saveEditing}>שמור</button>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setEditing(false)}>ביטול</button>
          </div>
        </div>
      ) : (
        <>
          {/* פרטי דוח */}
          <div style={{ marginTop: 20 }}>
            {typeLabel && (
              <div className="field-row">
                <span className="label">סוג</span>
                <span className="value">{typeLabel}</span>
              </div>
            )}
            {ALL_FIELDS.map(({ key, label }) => {
              let value = ticket[key];
              if (!value) return null;
              if (key === "amount_original" || key === "amount_updated") value = `₪${value}`;
              if (key.includes("url")) return null;
              if (key === "notes") return null;
              if (key === "violation_description") return null; // מוצג בנפרד
              return (
                <div className="field-row" key={key}>
                  <span className="label">{label}</span>
                  <span className="value">{value}</span>
                </div>
              );
            })}
          </div>

          {/* תיאור העבירה */}
          {ticket.violation_description && (
            <div style={{
              background: "white",
              border: "1px solid #e8ecf2",
              borderRadius: 10,
              padding: 16,
              marginTop: 16,
            }}>
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#8893a7", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                תיאור העבירה
              </div>
              <div style={{ fontSize: "0.9rem", color: "#1b2a4a", lineHeight: 1.7 }}>
                {ticket.violation_description.split(/[,.]/).map((part, i) => {
                  const trimmed = part.trim();
                  if (!trimmed) return null;
                  return <div key={i} style={{ padding: "3px 0" }}>{trimmed}</div>;
                })}
              </div>
            </div>
          )}

          <NotesSection notes={ticket.notes} />

          {/* כפתורי מעבר לאתר */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
            {ticket.payment_url && (
              <a href={ticket.payment_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button className="btn-primary" style={{ width: "100%", padding: "14px 24px", fontSize: "1rem" }}>
                  עבור לתשלום
                </button>
              </a>
            )}

            {ticket.appeal_url && (ticket.days_until_appeal === null || ticket.days_until_appeal >= 0) && (
              <a href={ticket.appeal_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button className="btn-secondary" style={{ width: "100%", padding: "14px 24px", fontSize: "1rem" }}>
                  {ticket.ticket_type === "police" ? "עבור לטופס ביטול דוח / ערעור" : "עבור לערעור"}
                </button>
              </a>
            )}

            {ticket.court_url && (ticket.days_until_court === null || ticket.days_until_court >= 0) && (
              <a href={ticket.court_url} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button className="btn-secondary" style={{ width: "100%", padding: "14px 24px", fontSize: "1rem" }}>
                  {ticket.ticket_type === "police" ? "עבור לטופס בקשה להישפט" : "עבור לבקשה להישפט"}
                </button>
              </a>
            )}

            {!ticket.payment_url && !ticket.appeal_url && !ticket.court_url && (
              <div style={{
                background: "#fff8eb",
                border: "1px solid #f59e0b",
                borderRadius: 10,
                padding: 14,
                fontSize: "0.85rem",
                lineHeight: 1.6,
                color: "#92400e",
              }}>
                <strong>לא נמצאו קישורים.</strong> לחצי על "עריכה" כדי להוסיף, או צלמי את גב הדוח.
              </div>
            )}
          </div>

          {/* פעולות */}
          <div className="actions" style={{ marginTop: 16 }}>
            {ticket.status !== "paid" && (
              <button className="btn-success" onClick={handleMarkPaid}>
                סמן כשולם
              </button>
            )}

            {ticket.status !== "paid" && (ticket.days_until_appeal === null || ticket.days_until_appeal >= 0) && (
              <button
                className="btn-secondary"
                onClick={() => navigate(`/ticket/${id}/appeal`)}
              >
                נסח ערעור עם AI
              </button>
            )}

            <button className="btn-danger" onClick={handleDelete}>
              מחק
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default TicketDetail;

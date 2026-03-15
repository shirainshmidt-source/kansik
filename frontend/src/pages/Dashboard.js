import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getTickets } from "../api";

function Dashboard({ user, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    function loadTickets() {
      getTickets()
        .then(setTickets)
        .catch(() => setTickets([]))
        .finally(() => setLoading(false));
    }

    loadTickets();

    // רענון גם כשחוזרים לדף (מהטאב או מדף אחר)
    function handleFocus() {
      loadTickets();
    }
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) loadTickets();
    });

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const urgentCount = tickets.filter((t) => {
    if (t.status === "paid" || t.status === "appeal_accepted") return false;
    // צובר ריבית
    if (t.days_until_payment !== null && t.days_until_payment < 0) return true;
    // 7 ימים לפני כל דדליין
    if (t.days_until_payment !== null && t.days_until_payment <= 7) return true;
    if (t.days_until_appeal !== null && t.days_until_appeal <= 7) return true;
    if (t.days_until_court !== null && t.days_until_court <= 7) return true;
    return false;
  }).length;

  function estimateOverdue(original, daysOverdue) {
    let amount = original * 1.5;
    const daysAfter = Math.max(0, daysOverdue - 90);
    const halfYears = Math.floor(daysAfter / 180);
    return Math.round(amount * Math.pow(1.05, halfYears));
  }

  const totalDebt = tickets
    .filter((t) => t.status !== "paid" && t.status !== "appeal_accepted")
    .reduce((sum, t) => {
      if (t.amount_updated) return sum + t.amount_updated;
      if (t.days_until_payment !== null && t.days_until_payment < 0 && t.amount_original) {
        return sum + estimateOverdue(t.amount_original, Math.abs(t.days_until_payment));
      }
      return sum + (t.amount_original || 0);
    }, 0);

  function getStatusBadge(ticket) {
    if (ticket.status === "paid") return { text: "שולם", className: "paid" };
    if (ticket.status === "appealed") return { text: "בערעור", className: "appealed" };
    if (ticket.status === "appeal_accepted") return { text: "ערעור התקבל", className: "paid" };
    // צובר ריבית
    if (ticket.days_until_payment !== null && ticket.days_until_payment < 0)
      return { text: "צובר ריבית", className: "overdue" };
    // דחוף - 7 ימים לפני כל דדליין
    const isUrgent =
      (ticket.days_until_payment !== null && ticket.days_until_payment <= 7) ||
      (ticket.days_until_appeal !== null && ticket.days_until_appeal <= 7) ||
      (ticket.days_until_court !== null && ticket.days_until_court <= 7);
    if (isUrgent) return { text: "דחוף", className: "urgent" };
    return { text: "תקין", className: "ok" };
  }

  function getDaysText(ticket) {
    if (ticket.days_until_payment === null) return "";
    if (ticket.days_until_payment < 0)
      return `עבר לפני ${Math.abs(ticket.days_until_payment)} ימים`;
    if (ticket.days_until_payment === 0) return "היום!";
    if (ticket.days_until_payment === 1) return "מחר";
    return `${ticket.days_until_payment} ימים`;
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
    <>
      <div className="header">
        <h1>קנסיק</h1>
        <div className="header-user">
          <span className="user-name">{user?.name}</span>
          <button className="btn-logout" onClick={onLogout}>יציאה</button>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="number">{tickets.length}</div>
          <div className="label">דוחות</div>
        </div>
        <div className="stat-card">
          <div className="number" style={{ color: "#dc3545" }}>{urgentCount}</div>
          <div className="label">דחופים</div>
        </div>
        <div className="stat-card">
          <div className="number" style={{ color: "#dc3545" }}>
            {totalDebt > 0 ? `${totalDebt.toLocaleString()}` : "0"}
          </div>
          <div className="label">סה"כ חוב</div>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>אין דוחות עדיין</p>
          <p style={{ marginTop: 8, fontSize: "0.9rem" }}>לחץ + כדי לסרוק דוח חדש</p>
        </div>
      ) : (
        tickets.map((ticket) => {
          const badge = getStatusBadge(ticket);
          return (
            <div
              key={ticket.id}
              className="ticket-card"
              onClick={() => navigate(`/ticket/${ticket.id}`)}
            >
              <div className="top-row">
                <span className="municipality">{ticket.municipality || "דוח"}</span>
                <span className="amount">
                  {ticket.days_until_payment !== null && ticket.days_until_payment < 0 && !ticket.amount_updated && ticket.amount_original
                    ? <span title="הערכה בלבד">
                        ~₪{estimateOverdue(ticket.amount_original, Math.abs(ticket.days_until_payment)).toLocaleString()}
                      </span>
                    : (ticket.amount_updated || ticket.amount_original)
                      ? `₪${(ticket.amount_updated || ticket.amount_original).toLocaleString()}`
                      : ""
                  }
                </span>
              </div>
              <div className="violation">
                {ticket.violation_description || ""}
                {ticket.location ? ` • ${ticket.location}` : ""}
              </div>
              <div className="ticket-alerts">
                {ticket.days_until_payment !== null && ticket.days_until_payment >= 0 && ticket.status !== "paid" && (
                  <span className={`mini-alert ${ticket.days_until_payment <= 7 ? "alert-urgent" : "alert-ok"}`}>
                    תשלום: {ticket.days_until_payment === 0 ? "היום!" : `${ticket.days_until_payment} ימים`}
                  </span>
                )}
                {ticket.days_until_appeal !== null && ticket.days_until_appeal >= 0 && ticket.status !== "paid" && (
                  <span className={`mini-alert ${ticket.days_until_appeal <= 7 ? "alert-urgent" : "alert-ok"}`}>
                    ערעור: {ticket.days_until_appeal === 0 ? "היום!" : `${ticket.days_until_appeal} ימים`}
                  </span>
                )}
                {ticket.days_until_court !== null && ticket.days_until_court >= 0 && ticket.status !== "paid" && (
                  <span className={`mini-alert ${ticket.days_until_court <= 7 ? "alert-urgent" : "alert-ok"}`}>
                    הישפטות: {ticket.days_until_court === 0 ? "היום!" : `${ticket.days_until_court} ימים`}
                  </span>
                )}
              </div>
              <div className="bottom-row">
                <span className={`status-badge ${badge.className}`}>{badge.text}</span>
                <span className="days-left">{getDaysText(ticket)}</span>
              </div>
            </div>
          );
        })
      )}

      <div className="fab-container">
        <button className="btn-scan" onClick={() => navigate("/scan")}>
          +
        </button>
      </div>
    </>
  );
}

export default Dashboard;

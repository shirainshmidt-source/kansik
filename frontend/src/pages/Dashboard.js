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
          <p style={{ marginTop: 8, fontSize: "0.9rem" }}>לחצי + כדי לסרוק דוח חדש</p>
        </div>
      ) : (
        tickets.map((ticket) => {
          const isOverdue = ticket.days_until_payment !== null && ticket.days_until_payment < 0 && ticket.status !== "paid";
          const isPaymentUrgent = ticket.days_until_payment !== null && ticket.days_until_payment >= 0 && ticket.days_until_payment <= 7;
          const isAppealUrgent = ticket.days_until_appeal !== null && ticket.days_until_appeal >= 0 && ticket.days_until_appeal <= 7;
          const hasUrgent = isPaymentUrgent || isAppealUrgent;

          const borderColor = isOverdue ? "#A32D2D" : hasUrgent ? "#BA7517" : "transparent";

          // חישוב סכום
          let displayAmount = ticket.amount_updated || ticket.amount_original || 0;
          let estimatedExtra = null;
          if (isOverdue && !ticket.amount_updated && ticket.amount_original) {
            const estimated = estimateOverdue(ticket.amount_original, Math.abs(ticket.days_until_payment));
            estimatedExtra = estimated - ticket.amount_original;
            displayAmount = estimated;
          }

          return (
            <div
              key={ticket.id}
              style={{
                background: "white",
                borderRadius: 12,
                padding: "16px",
                marginBottom: 8,
                cursor: "pointer",
                border: "1px solid #e8ecf2",
                borderRight: borderColor !== "transparent" ? `3px solid ${borderColor}` : "1px solid #e8ecf2",
                transition: "all 0.15s",
              }}
              onClick={() => navigate(`/ticket/${ticket.id}`)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 500, fontSize: 15, margin: "0 0 4px", color: "#1b2a4a" }}>
                    {ticket.municipality || "דוח"}
                  </p>
                  <p style={{ fontSize: 13, color: "#8893a7", margin: 0, lineHeight: 1.4 }}>
                    {ticket.violation_description || ""}
                  </p>
                </div>
                <div style={{ textAlign: "left", flexShrink: 0, marginRight: 12 }}>
                  <p style={{ fontWeight: 500, fontSize: 17, color: "#1b2a4a", margin: 0 }}>
                    {isOverdue && !ticket.amount_updated ? "~" : ""}{displayAmount.toLocaleString()}₪
                  </p>
                  {estimatedExtra && (
                    <p style={{ fontSize: 11, color: "#A32D2D", margin: "2px 0 0" }}>
                      +~{estimatedExtra.toLocaleString()}₪ ריבית
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#8893a7" }}>
                {/* ערעור */}
                {ticket.status !== "paid" && ticket.days_until_appeal !== null && (
                  <>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: ticket.days_until_appeal < 0 ? "#888780"
                          : ticket.days_until_appeal <= 7 ? "#BA7517" : "#1D9E75",
                      }} />
                      <span style={{ color: ticket.days_until_appeal < 0 ? "#8893a7"
                        : ticket.days_until_appeal <= 7 ? "#854F0B" : undefined }}>
                        {ticket.days_until_appeal < 0 ? "ערעור עבר"
                          : ticket.days_until_appeal === 0 ? "ערעור היום!"
                          : `ערעור ${ticket.days_until_appeal} ימים`}
                      </span>
                    </span>
                    <span style={{ color: "#ddd" }}>|</span>
                  </>
                )}

                {/* תשלום */}
                {ticket.status !== "paid" && ticket.days_until_payment !== null && !isOverdue && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: ticket.days_until_payment <= 7 ? "#BA7517" : "#1D9E75",
                    }} />
                    <span style={{ color: ticket.days_until_payment <= 7 ? "#854F0B" : undefined }}>
                      {ticket.days_until_payment === 0 ? "תשלום היום!"
                        : `תשלום ${ticket.days_until_payment} ימים`}
                    </span>
                  </span>
                )}

                {/* צובר ריבית */}
                {isOverdue && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#A32D2D" }} />
                    <span style={{ color: "#791F1F" }}>
                      באיחור {Math.abs(ticket.days_until_payment)} ימים · צובר ריבית
                    </span>
                  </span>
                )}

                {/* שולם */}
                {ticket.status === "paid" && (
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1b4dbc" }} />
                    <span>שולם</span>
                  </span>
                )}
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

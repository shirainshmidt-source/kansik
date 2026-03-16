import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getTickets, getTodayReminders } from "../api";

function estimateOverdue(original, daysOverdue) {
  let amount = original * 1.5;
  const daysAfter = Math.max(0, daysOverdue - 90);
  const halfYears = Math.floor(daysAfter / 180);
  return Math.round(amount * Math.pow(1.05, halfYears));
}

function TicketCard({ ticket, onClick, category }) {
  const isOverdue = category === "overdue";

  let displayAmount = ticket.amount_updated || ticket.amount_original || 0;
  let estimatedExtra = null;
  if (isOverdue && !ticket.amount_updated && ticket.amount_original) {
    const estimated = estimateOverdue(ticket.amount_original, Math.abs(ticket.days_until_payment));
    estimatedExtra = estimated - ticket.amount_original;
    displayAmount = estimated;
  }

  let bottomLabel, bottomValue, bottomColor;
  if (category === "appealable") {
    bottomLabel = "ערעור עד";
    const d = ticket.days_until_appeal;
    bottomValue = d === 0 ? "היום!" : d === 1 ? "מחר" : `${d} ימים`;
    bottomColor = d <= 7 ? "#854F0B" : "#1b2a4a";
  } else if (category === "payable") {
    bottomLabel = "תשלום עד";
    const d = ticket.days_until_payment;
    bottomValue = d === 0 ? "היום!" : d === 1 ? "מחר" : `${d} ימים`;
    bottomColor = d <= 7 ? "#854F0B" : "#1b2a4a";
  } else {
    bottomLabel = "באיחור";
    bottomValue = `${Math.abs(ticket.days_until_payment)} ימים`;
    bottomColor = "#791F1F";
  }

  return (
    <div
      onClick={onClick}
      style={{
        background: "white",
        borderRadius: 8,
        padding: "14px 16px",
        marginBottom: 8,
        cursor: "pointer",
        border: isOverdue ? "0.5px solid #E24B4A" : "0.5px solid #ddd",
        transition: "all 0.15s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 500, fontSize: 14, margin: "0 0 3px", color: "#1b2a4a" }}>
            {ticket.municipality || "דוח"}
          </p>
          <p style={{ fontSize: 12, color: "#888", margin: 0, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {ticket.violation_description || ""}
          </p>
        </div>
        <div style={{ textAlign: "left", flexShrink: 0, marginRight: 12 }}>
          <p style={{ fontWeight: 500, fontSize: 16, color: "#1b2a4a", margin: 0 }}>
            {isOverdue && !ticket.amount_updated ? "~" : ""}{displayAmount.toLocaleString()}₪
          </p>
          {estimatedExtra && (
            <p style={{ fontSize: 11, color: "#A32D2D", margin: "2px 0 0" }}>
              +~{estimatedExtra.toLocaleString()}₪ ריבית
            </p>
          )}
        </div>
      </div>

      <div style={{ borderTop: "0.5px solid #eee", marginTop: 10, paddingTop: 10 }}>
        <p style={{ fontSize: 10, color: "#888", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {bottomLabel}
        </p>
        <p style={{ fontSize: 13, fontWeight: 500, color: bottomColor, margin: 0 }}>
          {bottomValue}
        </p>
      </div>
    </div>
  );
}

function Dashboard({ user, onLogout }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const appealRef = useRef(null);
  const payableRef = useRef(null);
  const overdueRef = useRef(null);

  useEffect(() => {
    function loadTickets() {
      getTickets()
        .then(setTickets)
        .catch(() => setTickets([]))
        .finally(() => setLoading(false));
    }

    loadTickets();

    function handleFocus() {
      loadTickets();
    }
    window.addEventListener("focus", handleFocus);
    const handleVisibility = () => {
      if (!document.hidden) loadTickets();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  // בקשת הרשאת התראות ובדיקת תזכורות להיום
  useEffect(() => {
    async function checkNotifications() {
      if (!("Notification" in window)) return;

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }
      if (permission !== "granted") return;

      // בדיקה שלא שלחנו כבר היום
      const todayKey = "kansik_notified_" + new Date().toISOString().slice(0, 10);
      if (sessionStorage.getItem(todayKey)) return;

      try {
        const reminders = await getTodayReminders();
        reminders.forEach((r) => {
          new Notification("קנסיק - תזכורת", {
            body: r.message,
            icon: "/favicon.ico",
            dir: "rtl",
          });
        });
        if (reminders.length > 0) {
          sessionStorage.setItem(todayKey, "1");
        }
      } catch (e) {
        // ignore
      }
    }
    checkNotifications();
  }, []);

  // מיון לקטגוריות
  const activeTickets = tickets.filter((t) => t.status !== "paid" && t.status !== "appeal_accepted");

  const appealable = activeTickets
    .filter((t) => t.days_until_appeal !== null && t.days_until_appeal >= 0)
    .sort((a, b) => a.days_until_appeal - b.days_until_appeal);

  const payable = activeTickets
    .filter((t) => {
      const appealPassed = t.days_until_appeal === null || t.days_until_appeal < 0;
      const paymentOk = t.days_until_payment !== null && t.days_until_payment >= 0;
      return appealPassed && paymentOk;
    })
    .sort((a, b) => a.days_until_payment - b.days_until_payment);

  const overdue = activeTickets
    .filter((t) => t.days_until_payment !== null && t.days_until_payment < 0)
    .sort((a, b) => a.days_until_payment - b.days_until_payment);

  function scrollTo(ref) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        <p>טוען...</p>
      </div>
    );
  }

  const firstName = user?.name?.charAt(0) || "?";

  return (
    <div style={{ maxWidth: 400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0 20px" }}>
        <span style={{ fontWeight: 500, fontSize: 20, color: "#1b2a4a" }}>קנסיק</span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            onClick={() => navigate("/settings")}
            style={{ fontSize: 13, color: "#185FA5", cursor: "pointer", fontWeight: 500 }}
          >
            הגדרות
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={onLogout}>
            <span style={{ fontSize: 13, color: "#888" }}>{user?.name}</span>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", background: "#185FA5", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              {firstName}
            </div>
          </div>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#888" }}>
          <p style={{ fontSize: 14 }}>אין דוחות עדיין</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>לחצי + כדי לסרוק דוח חדש</p>
        </div>
      ) : (
        <>
          {/* שלושה כפתורי ניווט */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            <button
              onClick={() => scrollTo(appealRef)}
              style={{
                flex: 1, background: "white", border: "0.5px solid #ddd", borderRadius: 8,
                padding: "12px 8px", textAlign: "center", cursor: "pointer",
              }}
            >
              <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "#1b2a4a" }}>{appealable.length}</p>
              <p style={{ fontSize: 12, fontWeight: 500, margin: "4px 0 2px", color: "#1b2a4a" }}>ניתן לערעור</p>
              <p style={{ fontSize: 10, color: "#888", margin: 0 }}>מאפשר ביטול הדוח</p>
            </button>
            <button
              onClick={() => scrollTo(payableRef)}
              style={{
                flex: 1, background: "white", border: "0.5px solid #ddd", borderRadius: 8,
                padding: "12px 8px", textAlign: "center", cursor: "pointer",
              }}
            >
              <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "#854F0B" }}>{payable.length}</p>
              <p style={{ fontSize: 12, fontWeight: 500, margin: "4px 0 2px", color: "#1b2a4a" }}>תשלום בזמן</p>
              <p style={{ fontSize: 10, color: "#888", margin: 0 }}>לפני תוספת קנס</p>
            </button>
            <button
              onClick={() => scrollTo(overdueRef)}
              style={{
                flex: 1, background: "white", border: "0.5px solid #E24B4A", borderRadius: 8,
                padding: "12px 8px", textAlign: "center", cursor: "pointer",
              }}
            >
              <p style={{ fontSize: 20, fontWeight: 500, margin: 0, color: "#791F1F" }}>{overdue.length}</p>
              <p style={{ fontSize: 12, fontWeight: 500, margin: "4px 0 2px", color: "#791F1F" }}>תשלום באיחור</p>
              <p style={{ fontSize: 10, color: "#888", margin: 0 }}>נצברת ריבית</p>
            </button>
          </div>

          {/* קטגוריה 1: ניתן לערעור */}
          {appealable.length > 0 && (
            <div ref={appealRef} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 2px", color: "#1b2a4a" }}>ניתן לערעור</p>
              <p style={{ fontSize: 11, color: "#888", margin: "0 0 12px" }}>מאפשר ביטול הדוח</p>
              {appealable.map((t) => (
                <TicketCard key={t.id} ticket={t} category="appealable" onClick={() => navigate(`/ticket/${t.id}`)} />
              ))}
            </div>
          )}

          {/* קטגוריה 2: תשלום בזמן */}
          {payable.length > 0 && (
            <div ref={payableRef} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 2px", color: "#1b2a4a" }}>תשלום בזמן</p>
              <p style={{ fontSize: 11, color: "#888", margin: "0 0 12px" }}>לפני תוספת קנס</p>
              {payable.map((t) => (
                <TicketCard key={t.id} ticket={t} category="payable" onClick={() => navigate(`/ticket/${t.id}`)} />
              ))}
            </div>
          )}

          {/* קטגוריה 3: תשלום באיחור */}
          {overdue.length > 0 && (
            <div ref={overdueRef} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 500, margin: "0 0 2px", color: "#791F1F" }}>תשלום באיחור</p>
              <p style={{ fontSize: 11, color: "#888", margin: "0 0 12px" }}>נצברת ריבית</p>
              {overdue.map((t) => (
                <TicketCard key={t.id} ticket={t} category="overdue" onClick={() => navigate(`/ticket/${t.id}`)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* כפתור הוספה */}
      <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)" }}>
        <button
          onClick={() => navigate("/scan")}
          style={{
            width: 56, height: 56, borderRadius: "50%", background: "#185FA5",
            color: "white", fontSize: 24, display: "flex", alignItems: "center",
            justifyContent: "center", border: "none", cursor: "pointer",
            boxShadow: "0 4px 16px rgba(24, 95, 165, 0.3)",
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default Dashboard;

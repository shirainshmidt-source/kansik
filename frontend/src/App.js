import { useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { getStoredUser, logout } from "./api";
import Dashboard from "./pages/Dashboard";
import ScanTicket from "./pages/ScanTicket";
import TicketDetail from "./pages/TicketDetail";
import Appeal from "./pages/Appeal";
import Login from "./pages/Login";
import Register from "./pages/Register";

function App() {
  const [user, setUser] = useState(getStoredUser);

  function handleAuth(userData) {
    setUser(userData);
  }

  function handleLogout() {
    logout();
    setUser(null);
  }

  if (!user) {
    return (
      <div className="app">
        <Routes>
          <Route path="/register" element={<Register onAuth={handleAuth} />} />
          <Route path="*" element={<Login onAuth={handleAuth} />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Dashboard user={user} onLogout={handleLogout} />} />
        <Route path="/scan" element={<ScanTicket />} />
        <Route path="/ticket/:id" element={<TicketDetail />} />
        <Route path="/ticket/:id/appeal" element={<Appeal />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  );
}

export default App;

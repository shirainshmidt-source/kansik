import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000/api",
});

// הוספת טוקן JWT לכל בקשה
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// אם מקבלים 401 - מנקים את הטוקן ומפנים להתחברות
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// ──── אימות ────

export async function login(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export async function register(email, password, name) {
  const { data } = await api.post("/auth/register", { email, password, name });
  localStorage.setItem("token", data.access_token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getStoredUser() {
  const user = localStorage.getItem("user");
  const token = localStorage.getItem("token");
  if (user && token) {
    return JSON.parse(user);
  }
  return null;
}

// ──── דוחות ────

export async function scanTicket(frontImage, backImage) {
  const formData = new FormData();
  formData.append("front", frontImage);
  if (backImage) {
    formData.append("back", backImage);
  }
  const { data } = await api.post("/tickets/scan", formData);
  return data;
}

export async function createTicket(ticketData) {
  const { data } = await api.post("/tickets", ticketData);
  return data;
}

export async function getTickets() {
  const { data } = await api.get("/tickets");
  return data;
}

export async function getTicket(id) {
  const { data } = await api.get(`/tickets/${id}`);
  return data;
}

export async function updateTicket(id, updates) {
  const { data } = await api.patch(`/tickets/${id}`, updates);
  return data;
}

export async function deleteTicket(id) {
  await api.delete(`/tickets/${id}`);
}

export async function createAppeal(ticketId, reason) {
  const { data } = await api.post(`/tickets/${ticketId}/appeal`, { reason });
  return data;
}

export async function reviseAppeal(ticketId, appealText, correction) {
  const { data } = await api.post(`/tickets/${ticketId}/appeal/revise`, {
    appeal_text: appealText,
    correction,
  });
  return data;
}

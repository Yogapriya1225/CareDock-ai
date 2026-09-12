/**
 * Centralized Axios instance. Attaches JWT automatically and redirects
 * to /login on 401 responses.
 */
import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("caredock_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("caredock_token");
      localStorage.removeItem("caredock_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

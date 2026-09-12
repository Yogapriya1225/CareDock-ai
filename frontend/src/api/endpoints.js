/**
 * Thin wrappers around backend endpoints, grouped by domain.
 */
import api from "./client";

export const AuthAPI = {
  register: (data) => api.post("/api/auth/register", data),
  login: (data) => api.post("/api/auth/login", data),
  me: () => api.get("/api/auth/me"),
};

export const PatientAPI = {
  createProfile: (data) => api.post("/api/patient/", data),
  updateProfile: (data) => api.patch("/api/patient/me", data),
  byUser: (userId) => api.get(`/api/patient/by-user/${userId}`),
  dashboard: (patientId) => api.get(`/api/patient/${patientId}/dashboard`),
  getSchedule: (patientId) => api.get(`/api/patient/${patientId}/schedule`),
  getHistory: (patientId) => api.get(`/api/patient/${patientId}/history`),
  getActivity: (patientId) => api.get(`/api/patient/${patientId}/activity`),
  getRecoveryScores: (patientId) => api.get(`/api/patient/${patientId}/recovery-scores`),
  getAlerts: (patientId) => api.get(`/api/patient/${patientId}/alerts`),
  get: (patientId) => api.get(`/api/patient/${patientId}`),
};

export const DoctorAPI = {
  createProfile: (data) => api.post("/api/doctor/", data),
  updateProfile: (data) => api.patch("/api/doctor/me", data),
  byUser: (userId) => api.get(`/api/doctor/by-user/${userId}`),
  listPatients: (search) => api.get("/api/doctor/patients", { params: { search } }),
  highRiskPatients: () => api.get("/api/doctor/high-risk-patients"),
  liveAlerts: () => api.get("/api/doctor/alerts/live"),
  directory: () => api.get("/api/doctor/directory"),
  linkPatient: (patientId) => api.post(`/api/doctor/link-patient/${patientId}`),
};

export const CaregiverAPI = {
  createProfile: (data) => api.post("/api/caregiver/", data),
  updateProfile: (data) => api.patch("/api/caregiver/me", data),
  byUser: (userId) => api.get(`/api/caregiver/by-user/${userId}`),
  getPatients: (caregiverId) => api.get(`/api/caregiver/${caregiverId}/patients`),
  directory: () => api.get("/api/caregiver/directory"),
  allPatients: () => api.get("/api/caregiver/all-patients"),
  linkPatient: (patientId) => api.post(`/api/caregiver/link-patient/${patientId}`),
};

export const AdminAPI = {
  listUsers: () => api.get("/api/admin/users"),
  listHospitals: () => api.get("/api/admin/hospitals"),
  analyticsOverview: () => api.get("/api/admin/analytics/overview"),
};

export const MLAPI = {
  recomputeRisk: (patientId) => api.post(`/api/ml/${patientId}/recompute-risk`),
};

export const ChatbotAPI = {
  ask: (patientId, message) => api.post("/api/chatbot/ask", { patient_id: patientId, message }),
  history: (patientId) => api.get(`/api/chatbot/${patientId}/history`),
};


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
  getRiskAnalytics: (patientId, limit = 30) => api.get(`/api/patient/${patientId}/risk-analytics?limit=${limit}`),
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
  detailedUsers: () => api.get("/api/admin/users/detailed"),
  getUserDetails: (id) => api.get(`/api/admin/users/${id}/details`),
  listHospitals: () => api.get("/api/admin/hospitals"),
  createHospital: (data) => api.post("/api/admin/hospitals", data),
  updateHospital: (id, data) => api.put(`/api/admin/hospitals/${id}`, data),
  deleteHospital: (id) => api.delete(`/api/admin/hospitals/${id}`),
  linkDoctorHospital: (data) => api.post("/api/admin/link/doctor-hospital", data),
  linkPatientHospital: (data) => api.post("/api/admin/link/patient-hospital", data),
  linkPatientDoctor: (data) => api.post("/api/admin/link/patient-doctor", data),
  linkPatientCaregiver: (data) => api.post("/api/admin/link/patient-caregiver", data),
  analyticsOverview: () => api.get("/api/admin/analytics/overview"),
  deleteUser: (id) => api.delete(`/api/admin/users/${id}`),
  updateUser: (id, data) => api.put(`/api/admin/users/${id}`, data),
};

export const MLAPI = {
  predictRisk: (patientId) => api.post(`/api/ml/${patientId}/predict-risk`),
  getHistory: (patientId) => api.get(`/api/ml/${patientId}/history`),
  recomputeRisk: (patientId) => api.post(`/api/ml/${patientId}/predict-risk`), // legacy fallback
};

export const ChatbotAPI = {
  ask: (patientId, message) => api.post("/api/chatbot/ask", { patient_id: patientId, message }),
  history: (patientId) => api.get(`/api/chatbot/${patientId}/history`),
};


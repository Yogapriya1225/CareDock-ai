import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./components/ProtectedRoute";

import LandingPage from "./pages/landing/LandingPage";
import RoleLogin from "./pages/auth/RoleLogin";
import RoleRegister from "./pages/auth/RoleRegister";
import PatientDashboard from "./pages/patient/PatientDashboard";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import CaregiverDashboard from "./pages/caregiver/CaregiverDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            
            {/* Separate Login Routes */}
            <Route path="/patient/login" element={<RoleLogin targetRole="patient" />} />
            <Route path="/doctor/login" element={<RoleLogin targetRole="doctor" />} />
            <Route path="/caregiver/login" element={<RoleLogin targetRole="caregiver" />} />
            <Route path="/admin/login" element={<RoleLogin targetRole="admin" />} />

            {/* Separate Registration Routes */}
            <Route path="/patient/register" element={<RoleRegister targetRole="patient" />} />
            <Route path="/doctor/register" element={<RoleRegister targetRole="doctor" />} />
            <Route path="/caregiver/register" element={<RoleRegister targetRole="caregiver" />} />
            <Route path="/admin/register" element={<RoleRegister targetRole="admin" />} />

            <Route
              path="/patient/dashboard"
              element={
                <ProtectedRoute allowedRoles={["patient"]}>
                  <PatientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/doctor/dashboard"
              element={
                <ProtectedRoute allowedRoles={["doctor"]}>
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/caregiver/dashboard"
              element={
                <ProtectedRoute allowedRoles={["caregiver"]}>
                  <CaregiverDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Catch-all: redirect unknown routes to landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

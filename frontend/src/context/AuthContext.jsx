/**
 * Global auth state: current user, login/logout, role helpers, and profile ID.
 * Persists token + user to localStorage so refresh keeps the session.
 * Also resolves the role-specific profile ID (patient_id, doctor_id, caregiver_id)
 * so all dashboards can use the real ID instead of a hardcoded value.
 */
import { createContext, useContext, useEffect, useState } from "react";
import { AuthAPI, PatientAPI, DoctorAPI, CaregiverAPI } from "../api/endpoints";

const AuthContext = createContext(null);

async function fetchProfileId(user) {
  try {
    if (user.role === "patient") {
      const res = await PatientAPI.byUser(user.id);
      return { patient_profile_id: res.data.id };
    }
    if (user.role === "doctor") {
      const res = await DoctorAPI.byUser(user.id);
      return { doctor_profile_id: res.data.id };
    }
    if (user.role === "caregiver") {
      const res = await CaregiverAPI.byUser(user.id);
      return { caregiver_profile_id: res.data.id };
    }
  } catch {
    // Profile doesn't exist yet — the OnboardingForm will handle creation
  }
  return {};
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("caredock_user");
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("caredock_token");
    if (token && !user) {
      AuthAPI.me()
        .then(async (res) => {
          const profileIds = await fetchProfileId(res.data);
          const fullUser = { ...res.data, ...profileIds };
          setUser(fullUser);
          localStorage.setItem("caredock_user", JSON.stringify(fullUser));
        })
        .catch(() => {
          localStorage.removeItem("caredock_token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email, password) => {
    const res = await AuthAPI.login({ email, password });
    localStorage.setItem("caredock_token", res.data.access_token);
    const baseUser = res.data.user;
    const profileIds = await fetchProfileId(baseUser);
    const fullUser = { ...baseUser, ...profileIds };
    localStorage.setItem("caredock_user", JSON.stringify(fullUser));
    setUser(fullUser);
    return fullUser;
  };

  const register = async (payload) => {
    await AuthAPI.register(payload);
    return login(payload.email, payload.password);
  };

  const refreshUser = async () => {
    if (!user) return;
    const profileIds = await fetchProfileId(user);
    const fullUser = { ...user, ...profileIds };
    setUser(fullUser);
    localStorage.setItem("caredock_user", JSON.stringify(fullUser));
    return fullUser;
  };

  const logout = () => {
    localStorage.removeItem("caredock_token");
    localStorage.removeItem("caredock_user");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

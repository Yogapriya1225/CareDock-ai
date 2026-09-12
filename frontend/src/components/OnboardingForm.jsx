/**
 * OnboardingForm — shown after registration/login when a user doesn't yet
 * have a role-specific profile. Collects the required details and creates
 * the profile via the appropriate API, then calls refreshUser() so the
 * dashboard receives the correct profile ID.
 *
 * Uses Tailwind + proper light/dark classes so text/background contrasts
 * correctly in both modes. The <select> options use system colors to stay
 * readable in the browser's native dropdown.
 */
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { PatientAPI, DoctorAPI, CaregiverAPI } from "../api/endpoints";

const fieldsByRole = {
  patient: [
    { key: "date_of_birth", label: "Date of Birth", type: "date", required: false },
    {
      key: "gender",
      label: "Gender",
      type: "select",
      options: ["male", "female", "other", "prefer_not_to_say"],
      required: false,
    },
    { key: "diagnosis", label: "Diagnosis / Condition", type: "text", required: false, placeholder: "e.g. Diabetes Type 2" },
    { key: "discharge_date", label: "Hospital Discharge Date", type: "date", required: false },
    { key: "emergency_contact_name", label: "Emergency Contact Name", type: "text", required: false },
    { key: "emergency_contact_phone", label: "Emergency Contact Phone", type: "tel", required: false },
    { key: "device_id", label: "Smart Dispenser Device ID (optional)", type: "text", required: false, placeholder: "e.g. ESP32-001" },
  ],
  doctor: [
    { key: "specialization", label: "Specialization", type: "text", required: false, placeholder: "e.g. Cardiology" },
    { key: "license_number", label: "Medical License Number", type: "text", required: false },
  ],
  caregiver: [
    {
      key: "relationship_to_patient",
      label: "Relationship to Patient",
      type: "text",
      required: false,
      placeholder: "e.g. Family, Nurse, Friend",
    },
  ],
};

const titleByRole = {
  patient: "Complete Your Patient Profile",
  doctor: "Complete Your Doctor Profile",
  caregiver: "Complete Your Caregiver Profile",
};

const subtitleByRole = {
  patient: "We need a few details to monitor your health and recovery journey.",
  doctor: "Add your professional details so patients can be assigned to you.",
  caregiver: "Tell us a little about yourself so we can link you to the right patient.",
};

const emojiByRole = { patient: "🏥", doctor: "👨‍⚕️", caregiver: "🤝" };

export default function OnboardingForm({ onSkip }) {
  const { user, refreshUser } = useAuth();
  const { toggle, isDark } = useTheme();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const role = user?.role;
  const fields = fieldsByRole[role] || [];

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      );
      if (role === "patient") await PatientAPI.createProfile(payload);
      else if (role === "doctor") await DoctorAPI.createProfile(payload);
      else if (role === "caregiver") await CaregiverAPI.createProfile(payload);
      await refreshUser();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!fields.length) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-300 p-6">
      {/* Theme toggle — top right */}
      <button
        onClick={toggle}
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className="fixed top-5 right-5 px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        {isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}
      </button>

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-2xl mx-auto mb-4 shadow-lg">
            {emojiByRole[role]}
          </div>
          <h1 className="text-slate-900 dark:text-slate-100 text-2xl font-bold mb-2">
            {titleByRole[role]}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{subtitleByRole[role]}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/40 rounded-xl px-4 py-3 text-red-700 dark:text-red-400 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-slate-700 dark:text-slate-300 text-sm font-medium mb-1.5">
                {f.label}
                {f.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {f.type === "select" ? (
                <select
                  value={form[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  required={f.required}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  style={{ colorScheme: isDark ? "dark" : "light" }}
                >
                  <option value="">Select…</option>
                  {f.options.map((o) => (
                    <option key={o} value={o}>
                      {o.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type}
                  placeholder={f.placeholder || ""}
                  value={form[f.key] || ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  required={f.required}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                  style={{ colorScheme: isDark ? "dark" : "light" }}
                />
              )}
            </div>
          ))}

          <div className="flex flex-col gap-3 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="py-3 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
            >
              {loading ? "Saving…" : "Complete Profile →"}
            </button>
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="py-2.5 rounded-xl text-slate-500 dark:text-slate-400 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

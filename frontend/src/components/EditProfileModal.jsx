import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { PatientAPI, DoctorAPI, CaregiverAPI } from "../api/endpoints";

export default function EditProfileModal({ isOpen, onClose, onProfileSaved, currentProfile }) {
  const { user, refreshUser } = useAuth();
  const { isDark } = useTheme();

  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingOptions, setFetchingOptions] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [doctorsList, setDoctorsList] = useState([]);
  const [caregiversList, setCaregiversList] = useState([]);

  const role = user?.role;
  const hasExistingProfile = Boolean(
    role === "patient"
      ? user?.patient_profile_id
      : role === "doctor"
      ? user?.doctor_profile_id
      : user?.caregiver_profile_id
  );

  useEffect(() => {
    if (!isOpen) {
      setError("");
      setSuccess("");
      return;
    }

    // Pre-populate with currentProfile if passed, or defaults
    if (currentProfile) {
      setForm({
        date_of_birth: currentProfile.date_of_birth || "",
        gender: currentProfile.gender || "",
        diagnosis: currentProfile.diagnosis || "",
        discharge_date: currentProfile.discharge_date || "",
        emergency_contact_name: currentProfile.emergency_contact_name || "",
        emergency_contact_phone: currentProfile.emergency_contact_phone || "",
        device_id: currentProfile.device_id || "",
        assigned_doctor_id: currentProfile.assigned_doctor_id ? String(currentProfile.assigned_doctor_id) : "",
        assigned_caregiver_id: currentProfile.assigned_caregiver_id ? String(currentProfile.assigned_caregiver_id) : "",
        specialization: currentProfile.specialization || "",
        license_number: currentProfile.license_number || "",
        relationship_to_patient: currentProfile.relationship_to_patient || "",
      });
    }

    // If patient, load available doctors and caregivers
    if (role === "patient") {
      setFetchingOptions(true);
      Promise.all([
        DoctorAPI.directory().catch(() => ({ data: [] })),
        CaregiverAPI.directory().catch(() => ({ data: [] })),
      ])
        .then(([docsRes, caresRes]) => {
          setDoctorsList(docsRes.data || []);
          setCaregiversList(caresRes.data || []);
        })
        .finally(() => setFetchingOptions(false));
    }
  }, [isOpen, currentProfile, role]);

  if (!isOpen) return null;

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const payload = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v !== "" && v !== null && v !== undefined) {
          if (k === "assigned_doctor_id" || k === "assigned_caregiver_id") {
            payload[k] = v === "none" ? null : parseInt(v, 10);
          } else {
            payload[k] = v;
          }
        }
      });

      if (role === "patient") {
        if (hasExistingProfile) {
          await PatientAPI.updateProfile(payload);
        } else {
          await PatientAPI.createProfile(payload);
        }
      } else if (role === "doctor") {
        if (hasExistingProfile) {
          await DoctorAPI.updateProfile(payload);
        } else {
          await DoctorAPI.createProfile(payload);
        }
      } else if (role === "caregiver") {
        if (hasExistingProfile) {
          await CaregiverAPI.updateProfile(payload);
        } else {
          await CaregiverAPI.createProfile(payload);
        }
      }

      await refreshUser();
      setSuccess("Profile updated successfully!");
      if (onProfileSaved) {
        onProfileSaved();
      }
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to update profile. Please check your inputs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 my-8 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold p-1 rounded-lg"
          title="Close"
        >
          ✕
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {role === "patient" ? "🏥" : role === "doctor" ? "👨‍⚕️" : "🤝"}
            </span>
            <h2 className="text-xl font-bold">
              {hasExistingProfile ? "Edit Your Profile & Care Team" : "Complete Your Profile"}
            </h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Keep your health details up to date so your doctor and caregiver can provide seamless care.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-xl text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/50 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {role === "patient" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={form.date_of_birth || ""}
                    onChange={(e) => handleChange("date_of_birth", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    style={{ colorScheme: isDark ? "dark" : "light" }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    Gender
                  </label>
                  <select
                    value={form.gender || ""}
                    onChange={(e) => handleChange("gender", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    style={{ colorScheme: isDark ? "dark" : "light" }}
                  >
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Primary Diagnosis / Condition
                </label>
                <input
                  type="text"
                  placeholder="e.g. Type 2 Diabetes, Post-CABG recovery"
                  value={form.diagnosis || ""}
                  onChange={(e) => handleChange("diagnosis", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Hospital Discharge Date
                </label>
                <input
                  type="date"
                  value={form.discharge_date || ""}
                  onChange={(e) => handleChange("discharge_date", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  style={{ colorScheme: isDark ? "dark" : "light" }}
                />
              </div>

              {/* Connected Care Team Section */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-primary-600 dark:text-primary-400 mb-2">
                  Connected Care Team
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Assigned Doctor
                    </label>
                    <select
                      value={form.assigned_doctor_id || ""}
                      onChange={(e) => handleChange("assigned_doctor_id", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      style={{ colorScheme: isDark ? "dark" : "light" }}
                    >
                      <option value="">-- Choose Assigned Doctor --</option>
                      {doctorsList.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} ({doc.specialization})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Connected Caregiver
                    </label>
                    <select
                      value={form.assigned_caregiver_id || ""}
                      onChange={(e) => handleChange("assigned_caregiver_id", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      style={{ colorScheme: isDark ? "dark" : "light" }}
                    >
                      <option value="">-- Choose Connected Caregiver --</option>
                      {caregiversList.map((cg) => (
                        <option key={cg.id} value={cg.id}>
                          {cg.name} ({cg.relationship})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Emergency & Device Section */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Emergency Contact & IoT Hardware
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Emergency Contact Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Jane Doe"
                      value={form.emergency_contact_name || ""}
                      onChange={(e) => handleChange("emergency_contact_name", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Emergency Contact Phone
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +1 555 123 4567"
                      value={form.emergency_contact_phone || ""}
                      onChange={(e) => handleChange("emergency_contact_phone", e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                    CareDock IoT Smart Dispenser ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. ESP32-DISPENSER-001"
                    value={form.device_id || ""}
                    onChange={(e) => handleChange("device_id", e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Connects to your bedside pill dispenser load-cell and motion sensor.
                  </p>
                </div>
              </div>
            </>
          )}

          {role === "doctor" && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Medical Specialization
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cardiology, Internal Medicine, Neurology"
                  value={form.specialization || ""}
                  onChange={(e) => handleChange("specialization", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Medical License Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. MD-9876543"
                  value={form.license_number || ""}
                  onChange={(e) => handleChange("license_number", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </>
          )}

          {role === "caregiver" && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Relationship to Patient
                </label>
                <input
                  type="text"
                  placeholder="e.g. Spouse, Son/Daughter, Private Duty Nurse, Guardian"
                  value={form.relationship_to_patient || ""}
                  onChange={(e) => handleChange("relationship_to_patient", e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </>
          )}

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary text-sm shadow-md"
            >
              {loading ? "Saving Changes..." : "Save Profile Details"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

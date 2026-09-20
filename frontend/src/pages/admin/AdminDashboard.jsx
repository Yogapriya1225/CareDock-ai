import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import DashboardLayout from "../../components/DashboardLayout";
import { StatCard, RiskBadge, LoadingState, ErrorState, EmptyState } from "../../components/UI";
import { AdminAPI } from "../../api/endpoints";

const tabs = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "users", label: "Users & Profiles", icon: "👥" },
  { id: "hospitals", label: "Hospitals & Linkage", icon: "🏥" },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modals & form state
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", role: "" });
  
  // Hospital management state
  const [showAddHospital, setShowAddHospital] = useState(false);
  const [newHospital, setNewHospital] = useState({ name: "", address: "", contact_number: "" });
  const [submittingHospital, setSubmittingHospital] = useState(false);

  // Quick link state
  const [linkDocState, setLinkDocState] = useState({ doctorId: "", hospitalId: "" });
  const [linkPatState, setLinkPatState] = useState({ patientId: "", hospitalId: "" });
  const [linkingLoading, setLinkingLoading] = useState(false);

  const loadData = async () => {
    try {
      const [o, u, h] = await Promise.all([
        AdminAPI.analyticsOverview(),
        AdminAPI.detailedUsers(),
        AdminAPI.listHospitals(),
      ]);
      setOverview(o.data);
      setUsers(u.data);
      setHospitals(h.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load admin console.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter helpers
  const doctorsList = users.filter((u) => u.role === "doctor" && u.profile);
  const patientsList = users.filter((u) => u.role === "patient" && u.profile);
  const caregiversList = users.filter((u) => u.role === "caregiver" && u.profile);

  // Delete User handler
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user? All associated profiles will be removed.")) return;
    try {
      await AdminAPI.deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (selectedUser?.id === userId) setSelectedUser(null);
      addToast({ title: "User Deleted", message: "User was successfully removed from the system.", type: "info" });
      loadData();
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.response?.data?.detail || "Failed to delete user.", type: "error" });
    }
  };

  // Open Edit User Modal
  const handleOpenEdit = (u) => {
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name || "",
      email: u.email || "",
      role: u.role || "patient",
    });
  };

  // Save Edit User
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await AdminAPI.updateUser(editingUser.id, editForm);
      addToast({ title: "User Updated", message: "User details were updated successfully.", type: "success" });
      setEditingUser(null);
      await loadData();
    } catch (err) {
      addToast({ title: "Update Failed", message: err.response?.data?.detail || "Failed to update user.", type: "error" });
    }
  };

  // Create Hospital handler
  const handleCreateHospital = async (e) => {
    e.preventDefault();
    if (!newHospital.name.trim()) {
      addToast({ title: "Validation Error", message: "Hospital name is required.", type: "warning" });
      return;
    }
    setSubmittingHospital(true);
    try {
      await AdminAPI.createHospital(newHospital);
      addToast({ title: "Hospital Added", message: `Hospital "${newHospital.name}" added successfully!`, type: "success" });
      setNewHospital({ name: "", address: "", contact_number: "" });
      setShowAddHospital(false);
      await loadData();
    } catch (err) {
      addToast({ title: "Error", message: err.response?.data?.detail || "Failed to register hospital.", type: "error" });
    } finally {
      setSubmittingHospital(false);
    }
  };

  // Delete Hospital handler
  const handleDeleteHospital = async (hospitalId, hospitalName) => {
    if (!window.confirm(`Are you sure you want to delete "${hospitalName}"? Affiliated doctors and patients will be unlinked.`)) return;
    try {
      await AdminAPI.deleteHospital(hospitalId);
      addToast({ title: "Hospital Deleted", message: `Hospital "${hospitalName}" was deleted.`, type: "info" });
      await loadData();
    } catch (err) {
      addToast({ title: "Delete Failed", message: err.response?.data?.detail || "Failed to delete hospital.", type: "error" });
    }
  };

  // Link Doctor to Hospital
  const handleLinkDoctor = async (e) => {
    e.preventDefault();
    if (!linkDocState.doctorId || !linkDocState.hospitalId) {
      addToast({ title: "Selection Required", message: "Please select both a doctor and a hospital.", type: "warning" });
      return;
    }
    setLinkingLoading(true);
    try {
      await AdminAPI.linkDoctorHospital({
        doctor_id: parseInt(linkDocState.doctorId),
        hospital_id: parseInt(linkDocState.hospitalId),
      });
      addToast({ title: "Link Successful", message: "Doctor successfully linked to hospital.", type: "success" });
      setLinkDocState({ doctorId: "", hospitalId: "" });
      await loadData();
    } catch (err) {
      addToast({ title: "Link Failed", message: err.response?.data?.detail || "Failed to link doctor.", type: "error" });
    } finally {
      setLinkingLoading(false);
    }
  };

  // Link Patient to Hospital
  const handleLinkPatient = async (e) => {
    e.preventDefault();
    if (!linkPatState.patientId || !linkPatState.hospitalId) {
      addToast({ title: "Selection Required", message: "Please select both a patient and a hospital.", type: "warning" });
      return;
    }
    setLinkingLoading(true);
    try {
      await AdminAPI.linkPatientHospital({
        patient_id: parseInt(linkPatState.patientId),
        hospital_id: parseInt(linkPatState.hospitalId),
      });
      addToast({ title: "Link Successful", message: "Patient successfully linked to hospital.", type: "success" });
      setLinkPatState({ patientId: "", hospitalId: "" });
      await loadData();
    } catch (err) {
      addToast({ title: "Link Failed", message: err.response?.data?.detail || "Failed to link patient.", type: "error" });
    } finally {
      setLinkingLoading(false);
    }
  };

  // In-modal link handler for individual user
  const handleUpdateUserLinkage = async (userId, payload, successMsg) => {
    try {
      await AdminAPI.updateUser(userId, payload);
      addToast({ title: "Link Updated", message: successMsg, type: "success" });
      await loadData();
      // refresh selected user
      const updatedList = (await AdminAPI.detailedUsers()).data;
      const refreshed = updatedList.find((u) => u.id === userId);
      if (refreshed) setSelectedUser(refreshed);
    } catch (err) {
      addToast({ title: "Update Failed", message: err.response?.data?.detail || "Failed to update link.", type: "error" });
    }
  };

  return (
    <DashboardLayout
      links={tabs}
      title={`Admin Console — ${user?.full_name || "Administrator"}`}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {loading && <LoadingState label="Loading complete system data and telemetry..." />}
      {error && <ErrorState message={error} />}

      {overview && !loading && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Patients" value={overview.total_patients} accent="primary" sub="Registered records" />
            <StatCard label="Total Doctors" value={overview.total_doctors} accent="green" sub="Medical staff" />
            <StatCard label="Total Caregivers" value={overview.total_caregivers} accent="green" sub="Home care team" />
            <StatCard label="Unresolved Alerts" value={overview.unresolved_alerts} accent="amber" sub="Needs attention" />
            <StatCard label="High Risk Patients" value={overview.high_risk_patients} accent="red" sub="Flagged critical" />
          </div>

          {/* ========================================================================= */}
          {/* TAB: USERS & PROFILES (and OVERVIEW) */}
          {/* ========================================================================= */}
          {(activeTab === "overview" || activeTab === "users") && (
            <div className="card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>👥</span> Registered System Users & Profiles
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Full visibility and administrative control over all patients, doctors, caregivers, and admins.
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-300">
                  {users.length} Total Accounts
                </span>
              </div>

              {users.length === 0 ? (
                <EmptyState label="No users registered in the system." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase">
                        <th className="py-3 px-3">Name</th>
                        <th className="py-3 px-3">Role</th>
                        <th className="py-3 px-3">Email</th>
                        <th className="py-3 px-3">Diagnosis / Spec</th>
                        <th className="py-3 px-3">Hospital / Link</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {users.map((u) => {
                        const prof = u.profile;
                        const roleColor = {
                          patient: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                          doctor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
                          caregiver: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
                          admin: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                        }[u.role] || "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="py-3 px-3">
                              <p className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {u.full_name}
                                {prof?.risk_level === "high" && (
                                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="High Risk" />
                                )}
                              </p>
                              <span className="text-2xs text-slate-400">ID: #{u.id}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${roleColor}`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-slate-500 font-mono text-xs">
                              {u.email}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300">
                              {u.role === "patient" ? (
                                prof?.diagnosis ? (
                                  <span className="truncate max-w-[150px] inline-block" title={prof.diagnosis}>
                                    {prof.diagnosis}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 italic">No diagnosis</span>
                                )
                              ) : u.role === "doctor" ? (
                                prof?.specialization || <span className="text-slate-400 italic">No spec</span>
                              ) : u.role === "caregiver" ? (
                                prof?.relationship_to_patient || <span className="text-slate-400 italic">Caregiver</span>
                              ) : (
                                <span className="text-slate-400">System Admin</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                              {prof?.hospital_name ? (
                                <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50">
                                  🏥 {prof.hospital_name}
                                </span>
                              ) : (
                                <span className="text-slate-400 text-xs italic">Unlinked</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setSelectedUser(u)}
                                  className="text-primary-600 dark:text-primary-400 hover:text-primary-800 text-xs font-semibold px-2.5 py-1 bg-primary-50 dark:bg-primary-900/20 rounded hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
                                >
                                  👁️ View Details
                                </button>
                                <button
                                  onClick={() => handleOpenEdit(u)}
                                  className="text-amber-600 dark:text-amber-400 hover:text-amber-800 text-xs font-semibold px-2.5 py-1 bg-amber-50 dark:bg-amber-900/20 rounded hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="text-red-500 hover:text-red-700 text-xs font-semibold px-2.5 py-1 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                >
                                  🗑️ Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB: HOSPITALS & LINKAGE */}
          {/* ========================================================================= */}
          {(activeTab === "overview" || activeTab === "hospitals") && (
            <div className="space-y-6">
              {/* Partner Hospitals Card */}
              <div className="card space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>🏥</span> Partner Hospitals & Medical Centers
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Manage registered hospital networks, view affiliated doctors and admitted patients.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddHospital(!showAddHospital)}
                    className="btn-primary text-xs self-start sm:self-auto shadow-xs"
                  >
                    {showAddHospital ? "✕ Cancel" : "+ Register New Hospital"}
                  </button>
                </div>

                {/* Add Hospital Form */}
                {showAddHospital && (
                  <form onSubmit={handleCreateHospital} className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">Register Hospital Details</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Hospital Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. City General Hospital"
                          value={newHospital.name}
                          onChange={(e) => setNewHospital({ ...newHospital, name: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Address
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. 104 Health Ave, Metro City"
                          value={newHospital.address}
                          onChange={(e) => setNewHospital({ ...newHospital, address: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Contact Number
                        </label>
                        <input
                          type="tel"
                          placeholder="e.g. +1 800-555-0199"
                          value={newHospital.contact_number}
                          onChange={(e) => setNewHospital({ ...newHospital, contact_number: e.target.value })}
                          className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddHospital(false)}
                        className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingHospital}
                        className="btn-primary text-xs px-4 py-1.5"
                      >
                        {submittingHospital ? "Saving..." : "Save Hospital"}
                      </button>
                    </div>
                  </form>
                )}

                {/* Hospitals List */}
                {hospitals.length === 0 ? (
                  <EmptyState label="No partner hospitals registered yet. Click above to add one." />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {hospitals.map((h) => (
                      <div
                        key={h.id}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col justify-between"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-1.5">
                              <span>🏥</span> {h.name}
                            </h4>
                            <p className="text-xs text-slate-500 mt-1">{h.address || "No address specified"}</p>
                            <p className="text-xs font-mono text-slate-400 mt-0.5">📞 {h.contact_number || "No contact"}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteHospital(h.id, h.name)}
                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded"
                            title="Delete hospital"
                          >
                            🗑️
                          </button>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                          <span className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold">
                            👨‍⚕️ {h.doctor_count || 0} Doctor(s)
                          </span>
                          <span className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                            🛏️ {h.patient_count || 0} Patient(s)
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Link Hospital Operations Section */}
              <div className="card space-y-4">
                <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>🔗</span> Link Doctors & Patients to Hospitals
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Directly assign medical practitioners and discharged patients to partner hospital networks.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Link Doctor Form */}
                  <form onSubmit={handleLinkDoctor} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>👨‍⚕️</span> Link Doctor to Hospital
                    </h4>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Doctor
                      </label>
                      <select
                        value={linkDocState.doctorId}
                        onChange={(e) => setLinkDocState({ ...linkDocState, doctorId: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        required
                      >
                        <option value="">-- Choose Doctor --</option>
                        {doctorsList.map((d) => (
                          <option key={d.profile?.doctor_id} value={d.profile?.doctor_id}>
                            {d.full_name} ({d.profile?.specialization || "General"}) {d.profile?.hospital_name ? `[Current: ${d.profile.hospital_name}]` : "[Unlinked]"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Target Hospital
                      </label>
                      <select
                        value={linkDocState.hospitalId}
                        onChange={(e) => setLinkDocState({ ...linkDocState, hospitalId: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        required
                      >
                        <option value="">-- Choose Hospital --</option>
                        {hospitals.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.address || "No address"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={linkingLoading}
                      className="btn-primary text-xs w-full py-2 shadow-xs"
                    >
                      {linkingLoading ? "Linking..." : "Link Doctor to Hospital"}
                    </button>
                  </form>

                  {/* Link Patient Form */}
                  <form onSubmit={handleLinkPatient} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>🏥</span> Link Patient to Hospital
                    </h4>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Patient
                      </label>
                      <select
                        value={linkPatState.patientId}
                        onChange={(e) => setLinkPatState({ ...linkPatState, patientId: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        required
                      >
                        <option value="">-- Choose Patient --</option>
                        {patientsList.map((p) => (
                          <option key={p.profile?.patient_id} value={p.profile?.patient_id}>
                            {p.full_name} ({p.profile?.diagnosis || "No diagnosis"}) {p.profile?.hospital_name ? `[Current: ${p.profile.hospital_name}]` : "[Unlinked]"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Select Target Hospital
                      </label>
                      <select
                        value={linkPatState.hospitalId}
                        onChange={(e) => setLinkPatState({ ...linkPatState, hospitalId: e.target.value })}
                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        required
                      >
                        <option value="">-- Choose Hospital --</option>
                        {hospitals.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.name} ({h.address || "No address"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="submit"
                      disabled={linkingLoading}
                      className="btn-primary text-xs w-full py-2 shadow-xs"
                    >
                      {linkingLoading ? "Linking..." : "Link Patient to Hospital"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VIEW COMPLETE DETAILS FOR USER */}
      {/* ========================================================================= */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="card max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-5 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 font-bold text-lg flex items-center justify-center">
                  {selectedUser.full_name?.charAt(0) || "U"}
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                    {selectedUser.full_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                      {selectedUser.role}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{selectedUser.email}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-2 rounded-lg text-lg"
              >
                ✕
              </button>
            </div>

            {/* Role-Specific Profile View */}
            {selectedUser.role === "patient" && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  🏥 Patient Health & Diagnosis Record
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block">Diagnosis (Post-Discharge):</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.diagnosis || "None recorded"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Hospital Discharge Date:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.discharge_date || "Not set"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Date of Birth & Gender:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.date_of_birth || "N/A"} ({selectedUser.profile?.gender || "Not specified"})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Emergency Contact:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.emergency_contact_name || "None"} ({selectedUser.profile?.emergency_contact_phone || "No phone"})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Smart Dispenser Hardware ID:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.device_id || "None paired"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Current ML Risk Level:</span>
                    <RiskBadge level={selectedUser.profile?.risk_level || "unknown"} />
                  </div>
                </div>

                {/* Patient Linkages */}
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-2">
                  🔗 Patient Care & Hospital Linkages
                </h4>
                <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                  {/* Hospital Linkage */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-slate-400 block">Linked Partner Hospital:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedUser.profile?.hospital_name ? `🏥 ${selectedUser.profile.hospital_name}` : "⚠️ No hospital linked"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        id="hosp-select"
                        defaultValue={selectedUser.profile?.hospital_id || ""}
                        className="text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          handleUpdateUserLinkage(selectedUser.id, { hospital_id: val }, "Hospital linkage updated.");
                        }}
                      >
                        <option value="">-- No Hospital --</option>
                        {hospitals.map((h) => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Doctor Assignment */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-slate-400 block">Assigned Doctor:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedUser.profile?.assigned_doctor_name ? `👨‍⚕️ Dr. ${selectedUser.profile.assigned_doctor_name}` : "⚠️ No doctor assigned"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={selectedUser.profile?.assigned_doctor_id || ""}
                        className="text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          handleUpdateUserLinkage(selectedUser.id, { assigned_doctor_id: val }, "Doctor assignment updated.");
                        }}
                      >
                        <option value="">-- No Doctor --</option>
                        {doctorsList.map((d) => (
                          <option key={d.profile?.doctor_id} value={d.profile?.doctor_id}>
                            Dr. {d.full_name} ({d.profile?.specialization || "General"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Caregiver Assignment */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div>
                      <span className="text-slate-400 block">Assigned Caregiver:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {selectedUser.profile?.assigned_caregiver_name ? `🤝 ${selectedUser.profile.assigned_caregiver_name}` : "⚠️ No caregiver assigned"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={selectedUser.profile?.assigned_caregiver_id || ""}
                        className="text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                        onChange={(e) => {
                          const val = e.target.value ? parseInt(e.target.value) : null;
                          handleUpdateUserLinkage(selectedUser.id, { assigned_caregiver_id: val }, "Caregiver assignment updated.");
                        }}
                      >
                        <option value="">-- No Caregiver --</option>
                        {caregiversList.map((c) => (
                          <option key={c.profile?.caregiver_id} value={c.profile?.caregiver_id}>
                            {c.full_name} ({c.profile?.relationship_to_patient || "Caregiver"})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Doctor Profile View */}
            {selectedUser.role === "doctor" && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  👨‍⚕️ Medical Practitioner Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block">Medical Specialization:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.specialization || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Medical License Number:</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.license_number || "Not recorded"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Assigned Patients:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.patients_count || 0} patient(s) under supervision
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Current Hospital:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.hospital_name || "Unlinked"}
                    </span>
                  </div>
                </div>

                {/* Change Doctor's Hospital Linkage */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-400 block">Link to Hospital:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Change this doctor's hospital affiliation
                    </span>
                  </div>
                  <select
                    defaultValue={selectedUser.profile?.hospital_id || ""}
                    className="text-xs px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    onChange={(e) => {
                      const val = e.target.value ? parseInt(e.target.value) : null;
                      handleUpdateUserLinkage(selectedUser.id, { hospital_id: val }, "Doctor's hospital link updated.");
                    }}
                  >
                    <option value="">-- No Hospital --</option>
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Caregiver Profile View */}
            {selectedUser.role === "caregiver" && (
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  🤝 Caregiver Profile Details
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-400 block">Relationship to Patient:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.relationship_to_patient || "Caregiver"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Monitored Patients:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedUser.profile?.patients_count || 0} connected patient(s)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Admin Profile View */}
            {selectedUser.role === "admin" && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800/50 text-xs text-amber-800 dark:text-amber-200">
                ⭐ This user holds System Administrator privileges with full read, update, delete, and hospital linkage authority across the platform.
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  const u = selectedUser;
                  setSelectedUser(null);
                  handleOpenEdit(u);
                }}
                className="btn-secondary text-xs px-4 py-2"
              >
                ✏️ Edit Account Info
              </button>
              <button
                onClick={() => setSelectedUser(null)}
                className="btn-primary text-xs px-5 py-2"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT USER BASIC DETAILS */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="card max-w-md w-full space-y-4 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                Edit User Account (ID: #{editingUser.id})
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  User Role
                </label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="caregiver">Caregiver</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs px-4 py-1.5"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

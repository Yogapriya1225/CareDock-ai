import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";
import OnboardingForm from "../../components/OnboardingForm";
import EditProfileModal from "../../components/EditProfileModal";
import { StatCard, RiskBadge, LoadingState, ErrorState, EmptyState } from "../../components/UI";
import { CaregiverAPI, PatientAPI } from "../../api/endpoints";

const tabs = [
  { id: "status", label: "Patient Status", icon: "🏥" },
  { id: "activity", label: "Live Telemetry & Alerts", icon: "🔔" },
  { id: "connect", label: "Connect Patient", icon: "🤝" },
  { id: "profile", label: "Caregiver Profile", icon: "👤" },
];

export default function CaregiverDashboard() {
  const { user } = useAuth();
  const caregiverId = user?.caregiver_profile_id;

  const [skippedOnboarding, setSkippedOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState("status");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [patients, setPatients] = useState([]);
  const [allPatients, setAllPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkMsg, setLinkMsg] = useState("");

  const loadCaregiverData = async () => {
    if (!caregiverId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [patientsRes, allRes] = await Promise.all([
        CaregiverAPI.getPatients(caregiverId),
        CaregiverAPI.allPatients().catch(() => ({ data: [] })),
      ]);
      setPatients(patientsRes.data || []);
      setAllPatients(allRes.data || []);

      // If there are patients, fetch their alerts
      if (patientsRes.data && patientsRes.data.length > 0) {
        const alertPromises = patientsRes.data.map((p) =>
          PatientAPI.getAlerts(p.patient_id).catch(() => ({ data: [] }))
        );
        const alertsResults = await Promise.all(alertPromises);
        const combinedAlerts = alertsResults.flatMap((res) => res.data || []);
        setAlerts(combinedAlerts);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load caregiver dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaregiverData();
  }, [caregiverId]);

  if (!caregiverId && !skippedOnboarding) {
    return <OnboardingForm onSkip={() => setSkippedOnboarding(true)} />;
  }

  const handleLinkPatient = async (patientId) => {
    try {
      await CaregiverAPI.linkPatient(patientId);
      setLinkMsg("Successfully connected to patient!");
      await loadCaregiverData();
      setTimeout(() => setLinkMsg(""), 3500);
    } catch {
      setLinkMsg("Failed to connect to patient.");
    }
  };

  const totalMissed = patients.reduce((sum, p) => sum + (p.missed_medicine_count || 0), 0);
  const totalAlerts = patients.reduce((sum, p) => sum + (p.unresolved_alerts || 0), 0);

  return (
    <DashboardLayout
      links={tabs}
      title={`Welcome, ${user?.full_name || "Caregiver"}`}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onOpenProfile={() => setIsProfileModalOpen(true)}
      isIncompleteProfile={!caregiverId}
    >
      {loading && <LoadingState label="Loading linked patient status..." />}
      {error && <ErrorState message={error} />}

      {!loading && !error && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Patients Monitored" value={patients.length} sub="Connected patients" accent="primary" />
            <StatCard label="Missed Medicines" value={totalMissed} sub="Total across patients" accent="amber" />
            <StatCard label="Unresolved Alerts" value={totalAlerts} sub="Requires checking" accent="red" />
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: PATIENT STATUS */}
          {/* ========================================================================= */}
          {activeTab === "status" && (
            <div className="card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>🏥</span> Connected Patient Health Status
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Always connected to your assigned patient's medication adherence, recovery, and alerts.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab("connect")}
                  className="btn-primary text-xs self-start sm:self-auto shadow-xs"
                >
                  + Link Another Patient
                </button>
              </div>

              {patients.length === 0 ? (
                <div className="text-center py-12 space-y-4">
                  <EmptyState label="No patients currently linked to your caregiver profile." />
                  <button
                    onClick={() => setActiveTab("connect")}
                    className="btn-primary text-xs px-4 py-2"
                  >
                    🤝 Browse & Link a Patient Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {patients.map((p) => (
                    <div
                      key={p.patient_id}
                      className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 bg-white dark:bg-slate-800/80 shadow-xs flex flex-col justify-between gap-4"
                    >
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-lg text-slate-900 dark:text-slate-100">
                              {p.name || `Patient #${p.patient_id}`}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Diagnosis: {p.diagnosis || "General Monitoring"}
                            </p>
                          </div>
                          <RiskBadge level={p.risk_level} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block">Recovery Score</span>
                            <span className="font-bold text-base text-primary-600 dark:text-primary-400">
                              {p.recovery_score ? Math.round(p.recovery_score) : "—"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block">Missed Medicines</span>
                            <span className={`font-bold text-base ${p.missed_medicine_count > 0 ? "text-red-600" : "text-emerald-600"}`}>
                              {p.missed_medicine_count}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block">Unresolved Alerts</span>
                            <span className={`font-bold text-base ${p.unresolved_alerts > 0 ? "text-amber-600" : "text-slate-500"}`}>
                              {p.unresolved_alerts}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                            <span className="text-slate-400 block">Assigned Doctor</span>
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {p.assigned_doctor_name ? `Dr. ${p.assigned_doctor_name}` : "Not Assigned"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Emergency Contact & Call button */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-slate-400 block">Emergency Contact</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {p.emergency_contact_phone || "No phone listed"}
                          </span>
                        </div>
                        {p.emergency_contact_phone && (
                          <a
                            href={`tel:${p.emergency_contact_phone}`}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors flex items-center gap-1.5"
                          >
                            <span>📞</span> Call Now
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: LIVE TELEMETRY & ALERTS */}
          {/* ========================================================================= */}
          {activeTab === "activity" && (
            <div className="card space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>🔔</span> Live Telemetry Alerts Feed
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time medicine adherence and mobility notifications for your patients.
                </p>
              </div>

              {alerts.length === 0 ? (
                <EmptyState label="No alerts reported for your monitored patients." />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {alerts.map((a) => (
                    <li key={a.id} className="py-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            Patient #{a.patient_id}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              a.severity === "high"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            }`}
                          >
                            {a.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-0.5">
                          {a.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(a.created_at).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: CONNECT PATIENT */}
          {/* ========================================================================= */}
          {activeTab === "connect" && (
            <div className="card space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>🤝</span> Connect to a Patient
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Browse all post-discharge patients and link them to your continuous caregiver dashboard.
                  </p>
                </div>
                {linkMsg && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    {linkMsg}
                  </span>
                )}
              </div>

              {allPatients.length === 0 ? (
                <EmptyState label="No patients found in system." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                        <th className="py-3 px-4">Patient Name</th>
                        <th className="py-3 px-4">Diagnosis</th>
                        <th className="py-3 px-4">Connection Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {allPatients.map((p) => {
                        const isAlreadyLinked = p.assigned_caregiver_id === caregiverId;
                        return (
                          <tr key={p.patient_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                              {p.name}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              {p.diagnosis}
                            </td>
                            <td className="py-3 px-4">
                              {isAlreadyLinked ? (
                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  ✓ Connected to You
                                </span>
                              ) : p.assigned_caregiver_id ? (
                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                                  Other Caregiver
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                  Needs Caregiver
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => handleLinkPatient(p.patient_id)}
                                disabled={isAlreadyLinked}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                                  isAlreadyLinked
                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                                    : "btn-primary"
                                }`}
                              >
                                {isAlreadyLinked ? "Linked" : "Link to My Care"}
                              </button>
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
          {/* TAB 4: CAREGIVER PROFILE */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <div className="card max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">
                    Caregiver Profile Details
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Your relationship to the patient and contact details.
                  </p>
                </div>
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="btn-primary text-xs shadow-xs"
                >
                  ✏️ Edit Profile
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-3 text-sm">
                <div>
                  <span className="text-slate-400 text-xs block">Full Name</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {user?.full_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Relationship to Patient</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {user?.relationship_to_patient || "Caregiver"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Account Email</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {user?.email}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSaved={() => loadCaregiverData()}
        currentProfile={user}
      />
    </DashboardLayout>
  );
}

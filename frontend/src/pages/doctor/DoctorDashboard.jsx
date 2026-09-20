import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import DashboardLayout from "../../components/DashboardLayout";
import OnboardingForm from "../../components/OnboardingForm";
import EditProfileModal from "../../components/EditProfileModal";
import { StatCard, RiskBadge, LoadingState, ErrorState, EmptyState } from "../../components/UI";
import { DoctorAPI, PatientAPI } from "../../api/endpoints";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

const tabs = [
  { id: "patients", label: "Patient Panel", icon: "👥" },
  { id: "highrisk", label: "High-Risk Patients", icon: "🚨" },
  { id: "alerts", label: "Live Alerts", icon: "🔔" },
  { id: "monitoring", label: "Activity Monitor", icon: "📊" },
  { id: "profile", label: "Doctor Profile", icon: "👨‍⚕️" },
];

export default function DoctorDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const doctorId = user?.doctor_profile_id;

  const [activeTab, setActiveTab] = useState("patients");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [patients, setPatients] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Patient detailed monitoring state
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientMonitoringData, setPatientMonitoringData] = useState(null);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [linkSuccessMsg, setLinkSuccessMsg] = useState("");

  const loadDoctorData = async (searchTerm = "") => {
    if (!doctorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [patientsRes, alertsRes] = await Promise.all([
        DoctorAPI.listPatients(searchTerm),
        DoctorAPI.liveAlerts().catch(() => ({ data: [] })),
      ]);
      const fetchedPatients = patientsRes.data || [];
      setPatients(fetchedPatients);
      setAlerts(alertsRes.data || []);

      const highRisk = fetchedPatients.filter((p) => p.risk_level === "high");
      if (highRisk.length > 0) {
        addToast({
          title: "Critical: High-Risk Patients Detected",
          message: `${highRisk.length} patient(s) have been flagged with High Risk. Review immediately.`,
          type: "urgent",
          duration: 7000,
        });
      }

      // If a patient is selected, refresh their monitor data, else select the first patient
      if (fetchedPatients.length > 0) {
        if (!selectedPatientId) {
          setSelectedPatientId(fetchedPatients[0].patient_id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load doctor dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctorData();
  }, [doctorId]);

  // Load detailed monitoring info whenever selectedPatientId changes
  useEffect(() => {
    if (!selectedPatientId) return;

    let isMounted = true;
    setMonitoringLoading(true);

    Promise.all([
      PatientAPI.dashboard(selectedPatientId).catch(() => ({ data: null })),
      PatientAPI.getActivity(selectedPatientId).catch(() => ({ data: [] })),
      PatientAPI.getRecoveryScores(selectedPatientId).catch(() => ({ data: [] })),
      PatientAPI.getHistory(selectedPatientId).catch(() => ({ data: [] })),
    ])
      .then(([dashRes, actRes, scoresRes, histRes]) => {
        if (!isMounted) return;
        setPatientMonitoringData({
          dashboard: dashRes.data,
          activity: (actRes.data || []).slice().reverse().map((a) => ({
            time: new Date(a.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            inactivity: a.inactivity_minutes,
            motion: a.motion_detected,
          })),
          scores: (scoresRes.data || []).slice().reverse().map((s) => ({
            date: new Date(s.computed_at).toLocaleDateString([], { month: "short", day: "numeric" }),
            score: Math.round(s.score),
          })),
          history: histRes.data || [],
        });
      })
      .finally(() => {
        if (isMounted) setMonitoringLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedPatientId]);

  if (!doctorId) {
    return <OnboardingForm />;
  }

  const handleInspectPatient = (pId) => {
    setSelectedPatientId(pId);
    setActiveTab("monitoring");
  };

  const handleLinkPatient = async (pId) => {
    try {
      await DoctorAPI.linkPatient(pId);
      setLinkSuccessMsg("Patient assigned to your care successfully!");
      loadDoctorData();
      setTimeout(() => setLinkSuccessMsg(""), 3500);
    } catch {
      setLinkSuccessMsg("Failed to assign patient.");
    }
  };

  const highRiskPatientsList = patients.filter((p) => p.risk_level === "high");
  const selectedPatientObj = patients.find((p) => p.patient_id === selectedPatientId);

  return (
    <DashboardLayout
      links={tabs}
      title={`Dr. ${user?.full_name || ""}`}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onOpenProfile={() => setIsProfileModalOpen(true)}
      isIncompleteProfile={!doctorId}
    >
      {loading && <LoadingState label="Loading patient panel..." />}
      {error && <ErrorState message={error} />}

      {highRiskPatientsList.length > 0 && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-200 text-sm">Critical Attention Required</h3>
              <p className="text-red-600 dark:text-red-300 text-xs">You have {highRiskPatientsList.length} patient(s) flagged as High Risk. Please check the High-Risk Patients tab.</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveTab("highrisk")}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
          >
            View High-Risk →
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {/* Top Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Patients" value={patients.length} sub="Under monitoring" accent="primary" />
            <StatCard label="High-Risk Patients" value={highRiskPatientsList.length} sub="Requires attention" accent="red" />
            <StatCard label="Live Alerts" value={alerts.length} sub="Unresolved vitals alerts" accent="amber" />
            <StatCard label="Specialization" value={user?.specialization || "General Medicine"} sub="Active on roster" accent="green" />
          </div>

          {/* ========================================================================= */}
          {/* TAB 1: PATIENT PANEL */}
          {/* ========================================================================= */}
          {activeTab === "patients" && (
            <div className="card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span>👥</span> Patient Monitoring Roster
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click "Monitor Activity" on any patient to view their live vitals and sensor telemetry.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    className="border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 w-64 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Search by patient name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadDoctorData(search)}
                  />
                  <button
                    onClick={() => loadDoctorData(search)}
                    className="btn-secondary text-xs py-2 px-3"
                  >
                    Search
                  </button>
                </div>
              </div>

              {patients.length === 0 ? (
                <EmptyState label="No patients registered yet. Patients will appear here once onboarded." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                        <th className="py-3 px-4">Patient Name</th>
                        <th className="py-3 px-4">Diagnosis</th>
                        <th className="py-3 px-4">Recovery Score</th>
                        <th className="py-3 px-4">Risk Level</th>
                        <th className="py-3 px-4">Caregiver</th>
                        <th className="py-3 px-4">Emergency Phone</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {patients.map((p) => (
                        <tr key={p.patient_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                            {p.name}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {p.diagnosis}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                            {p.recovery_score ? Math.round(p.recovery_score) : "—"}
                          </td>
                          <td className="py-3 px-4">
                            <RiskBadge level={p.risk_level} />
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {p.caregiver_name ? `🤝 ${p.caregiver_name}` : <span className="text-slate-400 text-xs">Unassigned</span>}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500 text-xs">
                            {p.emergency_contact_phone || "—"}
                          </td>
                          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              onClick={() => handleInspectPatient(p.patient_id)}
                              className="px-3 py-1 text-xs font-semibold rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 hover:bg-primary-100 transition-colors"
                            >
                              📊 Monitor Activity →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: HIGH-RISK PATIENTS */}
          {/* ========================================================================= */}
          {activeTab === "highrisk" && (
            <div className="card space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-lg text-red-600 dark:text-red-400 flex items-center gap-2">
                  <span>🚨</span> High-Risk Patient Alert List
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Patients with elevated complication risks, high inactivity, or multiple missed medicines.
                </p>
              </div>

              {highRiskPatientsList.length === 0 ? (
                <EmptyState label="No high-risk patients currently! All monitored patients are stable." />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {highRiskPatientsList.map((p) => (
                    <div
                      key={p.patient_id}
                      className="p-4 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/20 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-base text-slate-900 dark:text-slate-100">
                            {p.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Diagnosis: {p.diagnosis}
                          </p>
                        </div>
                        <RiskBadge level="high" />
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-red-100 dark:border-red-900/30">
                        <div className="flex justify-between">
                          <span>Recovery Score:</span>
                          <span className="font-bold text-red-600 dark:text-red-400">
                            {p.recovery_score ? Math.round(p.recovery_score) : "—"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Emergency Contact:</span>
                          <span className="font-medium">{p.emergency_contact_phone || "Not listed"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>IoT Device ID:</span>
                          <span className="font-mono">{p.device_id || "Unpaired"}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleInspectPatient(p.patient_id)}
                        className="w-full py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors text-center"
                      >
                        Inspect Vitals & Activity →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: LIVE ALERTS */}
          {/* ========================================================================= */}
          {activeTab === "alerts" && (
            <div className="card space-y-4">
              <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>🔔</span> Active Medical & Telemetry Alerts
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time alerts triggered by missed medicines, excessive immobility, or high-risk AI evaluations.
                </p>
              </div>

              {alerts.length === 0 ? (
                <EmptyState label="No unresolved alerts. All patients are adhering to protocols!" />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {alerts.map((a) => (
                    <li key={a.id} className="py-3.5 flex items-start justify-between gap-4">
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
                        <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                          {a.message}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Triggered: {new Date(a.created_at).toLocaleString()}
                        </p>
                      </div>

                      <button
                        onClick={() => handleInspectPatient(a.patient_id)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 whitespace-nowrap"
                      >
                        Inspect Patient →
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: PATIENT ACTIVITY MONITOR */}
          {/* ========================================================================= */}
          {activeTab === "monitoring" && (
            <div className="space-y-6">
              {/* Patient Selector Bar */}
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📊</span>
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                        Patient Telemetry & Activity Inspection
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Continuous post-discharge monitoring: room mobility, smart dispenser logs, and score.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase">
                      Select Patient:
                    </label>
                    <select
                      value={selectedPatientId || ""}
                      onChange={(e) => setSelectedPatientId(Number(e.target.value))}
                      className="border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      {patients.map((p) => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.name} ({p.diagnosis || "General"})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Patient Summary Strip */}
                {selectedPatientObj && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-4">
                      <div>
                        <span className="text-slate-400 block">Current Risk</span>
                        <RiskBadge level={selectedPatientObj.risk_level} />
                      </div>
                      <div>
                        <span className="text-slate-400 block">Diagnosis</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedPatientObj.diagnosis}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Connected Caregiver</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedPatientObj.caregiver_name || "None"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Emergency Phone</span>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {selectedPatientObj.emergency_contact_phone || "Not set"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {linkSuccessMsg && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {linkSuccessMsg}
                        </span>
                      )}
                      <button
                        onClick={() => handleLinkPatient(selectedPatientObj.patient_id)}
                        className="btn-secondary text-xs py-1.5 px-3"
                      >
                        Assign to My Care Team
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {monitoringLoading ? (
                <LoadingState label="Fetching live telemetry and sensor history..." />
              ) : (
                <div className="space-y-6">
                  {/* Recovery Trend & Activity Graphs */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recovery Timeline */}
                    <div className="card">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                        <span>📈</span> Recovery Score Trajectory
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Historical trend calculated by AI risk scoring engine.
                      </p>

                      {!patientMonitoringData?.scores || patientMonitoringData.scores.length === 0 ? (
                        <EmptyState label="No recovery score history calculated yet for this patient." />
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <LineChart data={patientMonitoringData.scores}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis dataKey="date" fontSize={11} stroke="#94a3b8" />
                            <YAxis domain={[0, 100]} fontSize={11} stroke="#94a3b8" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                color: "#fff",
                                borderRadius: "12px",
                                border: "none",
                              }}
                            />
                            <Line type="monotone" dataKey="score" stroke="#2563eb" strokeWidth={3} />
                          </LineChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Room Mobility & Inactivity Graph */}
                    <div className="card">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                        <span>🚶</span> Room Mobility Logs (PIR Inactivity Minutes)
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        Periods of immobility detected by bedroom hardware.
                      </p>

                      {!patientMonitoringData?.activity || patientMonitoringData.activity.length === 0 ? (
                        <EmptyState label="No motion telemetry received yet." />
                      ) : (
                        <ResponsiveContainer width="100%" height={220}>
                          <BarChart data={patientMonitoringData.activity}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                            <XAxis dataKey="time" fontSize={10} stroke="#94a3b8" />
                            <YAxis fontSize={11} stroke="#94a3b8" />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                color: "#fff",
                                borderRadius: "12px",
                                border: "none",
                              }}
                            />
                            <Bar dataKey="inactivity" fill="#10b981" radius={[6, 6, 0, 0]} name="Inactivity (min)" />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                  </div>

                  {/* Medicine Adherence & Dispenser Logs Table */}
                  <div className="card">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                      <span>💊</span> Smart Dispenser Adherence History
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Verification logs captured via load-cell weight drops.
                    </p>

                    {!patientMonitoringData?.history || patientMonitoringData.history.length === 0 ? (
                      <EmptyState label="No medicine intake events recorded yet." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                              <th className="py-2.5 px-4">Timestamp</th>
                              <th className="py-2.5 px-4">Result</th>
                              <th className="py-2.5 px-4">Weight Differential (g)</th>
                              <th className="py-2.5 px-4">Telemetry Source</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {patientMonitoringData.history.slice(0, 10).map((h) => (
                              <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 text-xs">
                                <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">
                                  {new Date(h.recorded_at).toLocaleString()}
                                </td>
                                <td className="py-2.5 px-4">
                                  {h.taken ? (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                      ✓ Taken On Time
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                      ✗ Missed Dose
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 font-mono text-slate-500">
                                  {h.weight_reading_grams ? `${h.weight_reading_grams}g` : "—"}
                                </td>
                                <td className="py-2.5 px-4 text-slate-500 capitalize">
                                  {h.source || "ESP32 Dispenser"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: DOCTOR PROFILE */}
          {/* ========================================================================= */}
          {activeTab === "profile" && (
            <div className="card max-w-2xl mx-auto space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">
                    Physician Profile & Credentials
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Your professional details visible to patients and caregivers.
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
                    Dr. {user?.full_name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">Medical Specialization</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {user?.specialization || "General Medicine"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-xs block">License Number</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                    {user?.license_number || "MD-Active"}
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
        onProfileSaved={() => loadDoctorData()}
        currentProfile={user}
      />
    </DashboardLayout>
  );
}

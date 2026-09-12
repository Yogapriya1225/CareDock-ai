import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";
import OnboardingForm from "../../components/OnboardingForm";
import EditProfileModal from "../../components/EditProfileModal";
import { StatCard, RiskBadge, LoadingState, ErrorState, EmptyState } from "../../components/UI";
import { PatientAPI, ChatbotAPI, MLAPI } from "../../api/endpoints";
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
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "schedule", label: "Medicine Schedule", icon: "💊" },
  { id: "timeline", label: "Recovery Timeline", icon: "📈" },
  { id: "assistant", label: "AI Assistant", icon: "🤖" },
  { id: "careteam", label: "Care Team & Profile", icon: "👨‍⚕️" },
];

export default function PatientDashboard() {
  const { user } = useAuth();
  const patientId = user?.patient_profile_id;

  const [skippedOnboarding, setSkippedOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [recoveryHistory, setRecoveryHistory] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [recomputeMsg, setRecomputeMsg] = useState("");

  const loadAllData = async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [dashRes, scoresRes, activityRes, historyRes] = await Promise.all([
        PatientAPI.dashboard(patientId),
        PatientAPI.getRecoveryScores(patientId).catch(() => ({ data: [] })),
        PatientAPI.getActivity(patientId).catch(() => ({ data: [] })),
        PatientAPI.getHistory(patientId).catch(() => ({ data: [] })),
      ]);
      setDashboard(dashRes.data);
      setRecoveryHistory(
        scoresRes.data
          .slice()
          .reverse()
          .map((s) => ({
            date: new Date(s.computed_at).toLocaleDateString([], { month: "short", day: "numeric" }),
            score: Math.round(s.score),
          }))
      );
      setActivity(
        activityRes.data
          .slice()
          .reverse()
          .map((a) => ({
            time: new Date(a.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            inactivity: a.inactivity_minutes,
            motion: a.motion_detected,
          }))
      );
      setHistory(historyRes.data || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load dashboard. Please verify your profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [patientId]);

  // Show onboarding if no profile and user hasn't explicitly clicked "Skip for now"
  if (!patientId && !skippedOnboarding) {
    return <OnboardingForm onSkip={() => setSkippedOnboarding(true)} />;
  }

  const sendChat = async (messageToSend) => {
    const text = (messageToSend || chatInput).trim();
    if (!text) return;
    setChatLog((prev) => [...prev, { role: "user", content: text }]);
    if (!messageToSend) setChatInput("");
    setChatLoading(true);
    try {
      if (patientId) {
        const res = await ChatbotAPI.ask(patientId, text);
        setChatLog((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      } else {
        setTimeout(() => {
          setChatLog((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "Hello! Please complete your patient profile with diagnosis details so I can give you personalized recovery guidance.",
            },
          ]);
          setChatLoading(false);
        }, 500);
        return;
      }
    } catch {
      setChatLog((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I am having trouble connecting right now. Please try again or consult your doctor.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const recomputeRisk = async () => {
    if (!patientId) return;
    setRecomputing(true);
    setRecomputeMsg("");
    try {
      await MLAPI.recomputeRisk(patientId);
      setRecomputeMsg("Risk score recomputed successfully!");
      await loadAllData();
    } catch {
      setRecomputeMsg("Unable to recompute score right now.");
    } finally {
      setRecomputing(false);
      setTimeout(() => setRecomputeMsg(""), 3500);
    }
  };

  const patientDetails = dashboard?.patient || {};
  const assignedDoctor = dashboard?.assigned_doctor;
  const assignedCaregiver = dashboard?.assigned_caregiver;

  return (
    <DashboardLayout
      links={tabs}
      title={`Welcome back, ${user?.full_name || "Patient"}`}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onOpenProfile={() => setIsProfileModalOpen(true)}
      isIncompleteProfile={!patientId}
    >
      {loading && <LoadingState label="Loading your health and recovery data..." />}
      {error && <ErrorState message={error} />}

      {!loading && (
        <div className="space-y-6">
          {/* ========================================================================= */}
          {/* TAB 1: OVERVIEW */}
          {/* ========================================================================= */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  label="Adherence Today"
                  value={`${dashboard?.compliance_percent_today ?? 0}%`}
                  sub="Daily medicine adherence"
                  accent="green"
                />
                <StatCard
                  label="Recovery Score"
                  value={dashboard?.recovery_score ? Math.round(dashboard.recovery_score.score) : "—"}
                  sub={
                    dashboard?.recovery_score ? (
                      <RiskBadge level={dashboard.recovery_score.risk_level} />
                    ) : (
                      "Pending calculation"
                    )
                  }
                  accent="primary"
                />
                <StatCard
                  label="Active Alerts"
                  value={dashboard?.recent_alerts?.length ?? 0}
                  sub="Requires attention"
                  accent="red"
                />
                <StatCard
                  label="Next Appointment"
                  value={
                    dashboard?.next_appointment
                      ? new Date(dashboard.next_appointment.scheduled_at).toLocaleDateString()
                      : "None Scheduled"
                  }
                  sub={dashboard?.next_appointment?.reason || "Follow-up visit"}
                  accent="amber"
                />
              </div>

              {/* Connected Care Team & IoT Sync Card */}
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg flex items-center gap-2">
                      <span>🩺</span> Connected Care Team & Monitoring
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Your care team is always linked to your vitals and medicine dispenser.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsProfileModalOpen(true)}
                    className="btn-secondary text-xs self-start sm:self-auto"
                  >
                    ✏️ Change Care Team
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Doctor Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                          Assigned Doctor
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Connected" />
                      </div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                        {assignedDoctor ? `Dr. ${assignedDoctor.name}` : "Not Assigned"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {assignedDoctor?.specialization || "General Practice"}
                      </p>
                    </div>
                    {!assignedDoctor && (
                      <button
                        onClick={() => setIsProfileModalOpen(true)}
                        className="mt-3 text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline text-left"
                      >
                        + Choose Doctor Now
                      </button>
                    )}
                  </div>

                  {/* Caregiver Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                          Connected Caregiver
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Connected" />
                      </div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                        {assignedCaregiver ? assignedCaregiver.name : "Not Connected"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {assignedCaregiver?.relationship || "Caregiver Contact"}
                      </p>
                    </div>
                    {!assignedCaregiver && (
                      <button
                        onClick={() => setIsProfileModalOpen(true)}
                        className="mt-3 text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline text-left"
                      >
                        + Connect Caregiver
                      </button>
                    )}
                  </div>

                  {/* Device Sync Card */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                          IoT Smart Dispenser
                        </span>
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            patientDetails.device_id ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                      </div>
                      <p className="font-bold text-slate-900 dark:text-slate-100 text-base font-mono">
                        {patientDetails.device_id || "None Configured"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Load-cell dispenser & PIR motion sensor
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("timeline")}
                      className="mt-3 text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline text-left"
                    >
                      View Live Activity Logs →
                    </button>
                  </div>
                </div>
              </div>

              {/* Medicine & Alerts 2-Column */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Medicine Card */}
                <div className="card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>💊</span> Today's Medicine Schedule
                      </h3>
                      <button
                        onClick={() => setActiveTab("schedule")}
                        className="text-xs text-primary-600 dark:text-primary-400 font-medium hover:underline"
                      >
                        Full Schedule →
                      </button>
                    </div>
                    {!dashboard?.todays_schedule || dashboard.todays_schedule.length === 0 ? (
                      <EmptyState label="No scheduled medicines for today." />
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dashboard.todays_schedule.slice(0, 4).map((s) => (
                          <li key={s.id} className="py-3 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                                {s.medicine_name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {s.dosage || "Standard Dose"} • {s.scheduled_time}
                              </p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                              {s.frequency}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Recent Alerts Card */}
                <div className="card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>🔔</span> Recent Health Alerts
                      </h3>
                    </div>
                    {!dashboard?.recent_alerts || dashboard.recent_alerts.length === 0 ? (
                      <EmptyState label="No active alerts. All vital signs are normal!" />
                    ) : (
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dashboard.recent_alerts.slice(0, 4).map((a) => (
                          <li key={a.id} className="py-3 flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                {a.message}
                              </p>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {new Date(a.created_at).toLocaleString()}
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 text-xs font-semibold rounded-md ${
                                a.severity === "high"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              }`}
                            >
                              {a.severity.toUpperCase()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: MEDICINE SCHEDULE */}
          {/* ========================================================================= */}
          {activeTab === "schedule" && (
            <div className="space-y-6">
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>💊</span> Active Prescriptions & Dispenser Schedule
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Prescribed medication timings configured with your smart pill dispenser.
                    </p>
                  </div>
                </div>

                {!dashboard?.todays_schedule || dashboard.todays_schedule.length === 0 ? (
                  <EmptyState label="No active medicine schedule found. Please contact your doctor." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                          <th className="py-3 px-4">Medicine</th>
                          <th className="py-3 px-4">Dosage</th>
                          <th className="py-3 px-4">Scheduled Time</th>
                          <th className="py-3 px-4">Frequency</th>
                          <th className="py-3 px-4">Load-Cell Drop (g)</th>
                          <th className="py-3 px-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dashboard.todays_schedule.map((s) => (
                          <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                              {s.medicine_name}
                            </td>
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              {s.dosage || "Standard Dose"}
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-slate-100">
                              {s.scheduled_time}
                            </td>
                            <td className="py-3 px-4 capitalize text-slate-600 dark:text-slate-300">
                              {s.frequency}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500">
                              {s.expected_weight_drop_grams ? `${s.expected_weight_drop_grams}g` : "—"}
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                Active
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Medicine Intake History */}
              <div className="card">
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <span>📜</span> Adherence & Dispenser Intake History
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Recorded automatically when the load cell detects pill removal, or logged by the caregiver.
                </p>

                {history.length === 0 ? (
                  <EmptyState label="No medicine intake events recorded yet." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Result</th>
                          <th className="py-3 px-4">Dispenser Weight Change</th>
                          <th className="py-3 px-4">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {history.slice(0, 15).map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                              {new Date(h.recorded_at).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              {h.taken ? (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                  ✓ Taken On Time
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                  ✗ Missed Dose
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-slate-500">
                              {h.weight_reading_grams ? `${h.weight_reading_grams}g` : "—"}
                            </td>
                            <td className="py-3 px-4 capitalize text-slate-500">
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

          {/* ========================================================================= */}
          {/* TAB 3: RECOVERY TIMELINE */}
          {/* ========================================================================= */}
          {activeTab === "timeline" && (
            <div className="space-y-6">
              {/* Recovery Score Chart */}
              <div className="card">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <span>📈</span> Post-Discharge Recovery Score Timeline
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Calculated from medication adherence, PIR room mobility, and reported vitals.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {recomputeMsg && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                        {recomputeMsg}
                      </span>
                    )}
                    <button
                      onClick={recomputeRisk}
                      disabled={recomputing}
                      className="btn-primary text-xs shadow-xs"
                    >
                      {recomputing ? "Recomputing Score..." : "⚡ Recompute Risk Score"}
                    </button>
                  </div>
                </div>

                {recoveryHistory.length === 0 ? (
                  <EmptyState label="No recovery scores computed yet. Click 'Recompute Risk Score' above to generate your initial score." />
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={recoveryHistory}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="date" fontSize={12} stroke="#94a3b8" />
                      <YAxis domain={[0, 100]} fontSize={12} stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          color: "#fff",
                          borderRadius: "12px",
                          border: "none",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#2563eb"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#2563eb" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* PIR Activity Graph & Motion Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Graph */}
                <div className="card">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                    <span>🚶</span> Activity & Inactivity Log (Minutes)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    Inactivity duration tracked by the PIR motion sensor.
                  </p>

                  {activity.length === 0 ? (
                    <EmptyState label="No IoT activity records yet. Make sure your ESP32 device is transmitting." />
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={activity}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                        <XAxis dataKey="time" fontSize={11} stroke="#94a3b8" />
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

                {/* Raw Event Feed */}
                <div className="card flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                      <span>📡</span> Room Motion Sensor Logs
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Live events received from the bedside hardware.
                    </p>

                    {activity.length === 0 ? (
                      <EmptyState label="Awaiting sensor events..." />
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                        {activity.slice(0, 10).map((a, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full ${a.motion ? "bg-emerald-500" : "bg-amber-500"}`} />
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {a.motion ? "Motion Detected" : "Inactivity Period"}
                              </span>
                            </div>
                            <span className="text-slate-400">{a.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: AI WELLNESS ASSISTANT */}
          {/* ========================================================================= */}
          {activeTab === "assistant" && (
            <div className="card max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center text-xl shadow-sm">
                  🤖
                </span>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                    CareDock AI Health & Wellness Assistant
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ask questions about your medicine schedule, side effects, dietary advice, or recovery tips.
                  </p>
                </div>
              </div>

              {/* Chat Message Box */}
              <div className="h-80 overflow-y-auto space-y-3 p-4 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4">
                {chatLog.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <p className="text-sm text-slate-400">
                      Select a prompt below or type your question:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
                      {[
                        "What are my scheduled medicines for today?",
                        "What should I do if I miss a dose?",
                        "What are general post-discharge care precautions?",
                        "Explain my current recovery score.",
                      ].map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => sendChat(prompt)}
                          className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-500 text-slate-700 dark:text-slate-300 transition-colors shadow-2xs text-left"
                        >
                          💡 {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  chatLog.map((m, i) => (
                    <div
                      key={i}
                      className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`text-sm max-w-[80%] px-4 py-2.5 rounded-2xl ${
                          m.role === "user"
                            ? "bg-primary-600 text-white rounded-br-xs"
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700/60 rounded-bl-xs shadow-2xs"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-primary-500 border-t-transparent rounded-full" />
                    CareDock AI is reviewing your medical chart...
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="flex gap-2">
                <input
                  className="flex-1 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="Ask a question about your medication or symptoms..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                />
                <button
                  className="btn-primary text-sm px-5"
                  onClick={() => sendChat()}
                  disabled={chatLoading}
                >
                  Send
                </button>
              </div>

              <p className="text-2xs text-slate-400 mt-2 text-center">
                Disclaimer: CareDock AI is for guidance and explanation only. For urgent symptoms, always contact emergency medical services.
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: CARE TEAM & PROFILE */}
          {/* ========================================================================= */}
          {activeTab === "careteam" && (
            <div className="card max-w-3xl mx-auto space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100">
                    My Patient Profile & Connected Care Team
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    View or modify your personal health record, caregiver, and doctor connection.
                  </p>
                </div>
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="btn-primary text-xs shadow-xs"
                >
                  ✏️ Edit Profile Details
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal & Medical Info */}
                <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                  <h4 className="font-semibold text-sm text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                    Medical Information
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-400 text-xs block">Diagnosis / Condition</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {patientDetails.diagnosis || "Not specified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">Date of Birth</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {patientDetails.date_of_birth ? String(patientDetails.date_of_birth) : "Not provided"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">Gender</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100 capitalize">
                        {patientDetails.gender ? patientDetails.gender.replace(/_/g, " ") : "Not provided"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">Hospital Discharge Date</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {patientDetails.discharge_date ? String(patientDetails.discharge_date) : "Not recorded"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Emergency & IoT Setup */}
                <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                  <h4 className="font-semibold text-sm text-primary-600 dark:text-primary-400 uppercase tracking-wider">
                    Emergency & Hardware
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-slate-400 text-xs block">Emergency Contact</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {patientDetails.emergency_contact_name || "None added"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">Emergency Phone</span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {patientDetails.emergency_contact_phone || "None added"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-xs block">Smart Dispenser Device ID</span>
                      <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                        {patientDetails.device_id || "Unpaired"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Care Team Connection Banner */}
              <div className="p-4 rounded-2xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800/60 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-sm text-primary-900 dark:text-primary-200">
                    Always Connected with Caregiver & Doctor
                  </h4>
                  <p className="text-xs text-primary-700 dark:text-primary-300 mt-0.5">
                    Your assigned doctor and caregiver can view your alerts, adherence, and activity logs 24/7.
                  </p>
                </div>
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="btn-primary text-xs whitespace-nowrap shadow-xs"
                >
                  Manage Care Team Connections
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        onProfileSaved={() => loadAllData()}
        currentProfile={dashboard?.patient}
      />
    </DashboardLayout>
  );
}

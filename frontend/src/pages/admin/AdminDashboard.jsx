import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import DashboardLayout from "../../components/DashboardLayout";
import { StatCard, LoadingState, ErrorState, EmptyState } from "../../components/UI";
import { AdminAPI } from "../../api/endpoints";

const tabs = [
  { id: "overview", label: "Overview", icon: "📊" },
  { id: "users", label: "Users", icon: "👥" },
  { id: "hospitals", label: "Hospitals", icon: "🏥" },
];

export default function AdminDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([AdminAPI.analyticsOverview(), AdminAPI.listUsers(), AdminAPI.listHospitals()])
      .then(([o, u, h]) => {
        setOverview(o.data);
        setUsers(u.data);
        setHospitals(h.data);
      })
      .catch((err) => setError(err.response?.data?.detail || "Failed to load admin dashboard."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout
      links={tabs}
      title={`Admin Console — ${user?.full_name || ""}`}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {loading && <LoadingState label="Loading system analytics..." />}
      {error && <ErrorState message={error} />}

      {overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Patients" value={overview.total_patients} accent="primary" />
            <StatCard label="Total Doctors" value={overview.total_doctors} accent="green" />
            <StatCard label="Total Caregivers" value={overview.total_caregivers} accent="green" />
            <StatCard label="Unresolved Alerts" value={overview.unresolved_alerts} accent="amber" />
            <StatCard label="High Risk Patients" value={overview.high_risk_patients} accent="red" />
          </div>

          {(activeTab === "overview" || activeTab === "users") && (
            <div className="card">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <span>👥</span> Registered System Users
              </h3>
              {users.length === 0 ? (
                <EmptyState label="No users found." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase">
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            {u.full_name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 capitalize">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">
                            {u.email}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {(activeTab === "overview" || activeTab === "hospitals") && (
            <div className="card">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <span>🏥</span> Partner Hospitals
              </h3>
              {hospitals.length === 0 ? (
                <EmptyState label="No partner hospitals registered yet." />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {hospitals.map((h) => (
                    <li key={h.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{h.name}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{h.address}</p>
                      </div>
                      <span className="text-xs font-mono text-slate-400">{h.contact_number || "No phone"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

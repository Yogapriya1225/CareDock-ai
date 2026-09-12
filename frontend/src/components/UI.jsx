export function StatCard({ label, value, sub, accent = "primary" }) {
  const accentClasses = {
    primary: "text-primary-600",
    green: "text-careGreen-600",
    amber: "text-amber-600",
    red: "text-red-600",
  };
  return (
    <div className="card">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${accentClasses[accent] || accentClasses.primary}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export function RiskBadge({ level }) {
  const cls = level === "high" ? "badge-high" : level === "medium" ? "badge-medium" : "badge-low";
  return <span className={cls}>{(level || "unknown").toUpperCase()}</span>;
}

export function LoadingState({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
      <div className="animate-spin h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full mr-3" />
      {label}
    </div>
  );
}

export function EmptyState({ label = "Nothing here yet." }) {
  return <div className="text-center py-12 text-slate-400 text-sm">{label}</div>;
}

export function ErrorState({ message = "Something went wrong." }) {
  return (
    <div className="text-center py-12 text-red-500 text-sm bg-red-50 dark:bg-red-900/10 rounded-xl">
      {message}
    </div>
  );
}

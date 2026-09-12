import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function DashboardLayout({
  links = [],
  title,
  activeTab,
  onTabChange,
  onOpenProfile,
  isIncompleteProfile,
  children,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shadow-sm">
        <div>
          {/* Logo */}
          <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 font-bold text-lg text-primary-700 dark:text-primary-400">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-700 to-primary-500 text-white flex items-center justify-center text-base shadow-sm">
                ⚓
              </span>
              CareDock AI
            </div>
          </div>

          {/* Navigation Links / Tabs */}
          <nav className="p-3 space-y-1">
            {links.map((l) => {
              const isTabActive = activeTab ? activeTab === l.id : location.pathname === l.to;
              return onTabChange ? (
                <button
                  key={l.id || l.label}
                  type="button"
                  onClick={() => onTabChange(l.id)}
                  className={`w-full text-left flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isTabActive
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {l.icon && <span className="text-base">{l.icon}</span>}
                  <span>{l.label}</span>
                </button>
              ) : (
                <Link
                  key={l.label}
                  to={l.to}
                  className={`block px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isTabActive
                      ? "bg-primary-50 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300 font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Panel */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/50">
          {/* Dark/Light Toggle */}
          <button
            onClick={toggle}
            type="button"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors shadow-2xs"
          >
            <span className="flex items-center gap-2">
              <span>{isDark ? "🌙" : "☀️"}</span>
              <span>{isDark ? "Dark Mode" : "Light Mode"}</span>
            </span>
            <span
              style={{
                display: "inline-flex",
                width: "36px",
                height: "20px",
                borderRadius: "999px",
                background: isDark ? "#2563eb" : "#cbd5e1",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "2px",
                  left: isDark ? "18px" : "2px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                }}
              />
            </span>
          </button>

          {/* User Info & Edit Profile Trigger */}
          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                  {user?.full_name || "User"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">
                  {user?.role}
                </p>
              </div>
              {onOpenProfile && (
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300 hover:bg-primary-100 transition-colors"
                  title="Edit Profile"
                >
                  Edit
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {onOpenProfile && (
              <button
                type="button"
                className="flex-1 btn-secondary text-xs py-2 text-center"
                onClick={onOpenProfile}
              >
                ⚙️ Profile
              </button>
            )}
            <button
              type="button"
              className="flex-1 btn-secondary text-xs py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              onClick={() => {
                logout();
                navigate("/");
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {/* Incomplete Profile Banner */}
        {isIncompleteProfile && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/60 text-amber-900 dark:text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="font-semibold text-sm">Incomplete Profile Details</h4>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  You skipped onboarding or haven't finished your profile setup. Complete your profile so your doctor, caregiver, and smart health devices can monitor you properly.
                </p>
              </div>
            </div>
            {onOpenProfile && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap shadow-sm transition-colors"
              >
                Complete Profile Now →
              </button>
            )}
          </div>
        )}

        {/* Header with Title and Profile Edit Button */}
        <div className="flex items-center justify-between mb-6 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
              {title}
            </h1>
          </div>
          {onOpenProfile && (
            <button
              type="button"
              onClick={onOpenProfile}
              className="btn-secondary text-xs flex items-center gap-1.5 shadow-2xs"
            >
              <span>✏️</span>
              <span>Edit Profile & Care Team</span>
            </button>
          )}
        </div>

        {children}
      </main>
    </div>
  );
}

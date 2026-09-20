import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const dashboardPath = user ? `/${user.role}/dashboard` : "/login";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur bg-white/80 dark:bg-slate-950/80 border-b border-slate-100 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary-700 dark:text-primary-400">
          <span className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center text-sm">C</span>
          CareDock AI
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <a href="/#features" className="hover:text-primary-600">Features</a>
          <a href="/#how-it-works" className="hover:text-primary-600">How It Works</a>
          <a href="/#hardware" className="hover:text-primary-600">Hardware</a>
          <a href="/#testimonials" className="hover:text-primary-600">Testimonials</a>
          <a href="/#contact" className="hover:text-primary-600">Contact</a>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <button className="btn-secondary text-sm" onClick={() => navigate(dashboardPath)}>
                Dashboard
              </button>
              <button
                className="btn-primary text-sm"
                onClick={() => {
                  logout();
                  navigate("/");
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button className="btn-secondary text-sm" onClick={() => {
                const rolesEl = document.getElementById("roles");
                if (rolesEl) { rolesEl.scrollIntoView({ behavior: "smooth" }); }
                else { navigate("/#roles"); }
              }}>
                Login
              </button>
              <button className="btn-primary text-sm" onClick={() => {
                const rolesEl = document.getElementById("roles");
                if (rolesEl) { rolesEl.scrollIntoView({ behavior: "smooth" }); }
                else { navigate("/#roles"); }
              }}>
                Get Started
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

const roleTitles = {
  patient: "Patient Portal",
  doctor: "Doctor Portal",
  caregiver: "Caregiver Portal",
  admin: "Admin Console",
};

export default function RoleLogin({ targetRole }) {
  const { register, handleSubmit, formState: { errors } } = useForm();
  const { login } = useAuth();
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setServerError("");
    setLoading(true);
    try {
      const user = await login(data.email, data.password);
      if (user.role !== targetRole) {
        setServerError(`This account is registered as a ${user.role}, not a ${targetRole}. Please use the correct portal.`);
        return;
      }
      navigate(`/${user.role}/dashboard`);
    } catch (err) {
      setServerError(err.response?.data?.detail || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-6 relative transition-colors duration-200">
      <button
        type="button"
        onClick={toggle}
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        className="fixed top-5 right-5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
      >
        <span>{isDark ? "☀️ Light Mode" : "🌙 Dark Mode"}</span>
      </button>

      <div className="card w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-xl rounded-3xl">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-700 to-primary-500 text-white flex items-center justify-center text-lg shadow-sm">
            ⚓
          </span>
          <div>
            <h2 className="font-bold text-lg text-slate-900 dark:text-slate-100 leading-tight">
              CareDock AI
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {roleTitles[targetRole]}
            </p>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-1 text-slate-900 dark:text-slate-100 capitalize">
          {targetRole} Login
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          Log in to access your {targetRole} dashboard
        </p>

        {serverError && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300 text-sm rounded-xl px-4 py-3 mb-4 border border-red-200 dark:border-red-800/40">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Email Address
            </label>
            <input
              type="email"
              placeholder="name@example.com"
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              style={{ colorScheme: isDark ? "dark" : "light" }}
              {...register("email", { required: "Email is required" })}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              style={{ colorScheme: isDark ? "dark" : "light" }}
              {...register("password", { required: "Password is required" })}
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-sm font-semibold shadow-md mt-2"
          >
            {loading ? "Signing in..." : "Log In →"}
          </button>
        </form>

        <p className="text-sm text-slate-500 dark:text-slate-400 mt-6 text-center">
          Don't have an account?{" "}
          <Link to={`/${targetRole}/register`} className="text-primary-600 dark:text-primary-400 font-semibold hover:underline">
            Sign up
          </Link>
        </p>
        <p className="text-xs text-slate-400 mt-4 text-center">
          <Link to="/" className="hover:underline">← Back to Home</Link>
        </p>
      </div>
    </div>
  );
}

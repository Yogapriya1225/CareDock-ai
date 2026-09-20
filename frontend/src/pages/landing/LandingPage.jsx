import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Navbar from "../../components/Navbar";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-slate-950">
      <Navbar />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-24 grid md:grid-cols-2 gap-12 items-center">
        <motion.div initial="hidden" animate="show" variants={fadeUp}>
          <span className="inline-block bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 px-3 py-1 rounded-full text-xs font-semibold mb-4">
            AI + IoT Powered Recovery Monitoring
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            Smarter recovery, starting the moment your patient goes home.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">
            CareDock AI pairs a smart medicine box with AI-driven monitoring to track medication
            adherence, activity, and recovery risk after discharge — so doctors and caregivers
            can step in before small issues become emergencies.
          </p>
          <div className="flex gap-4">
            <button className="btn-primary" onClick={() => document.getElementById("roles")?.scrollIntoView({ behavior: "smooth" })}>
              Get Started Free
            </button>
            <button className="btn-secondary" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
              See How It Works
            </button>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="card bg-gradient-to-br from-primary-50 to-careGreen-50 dark:from-primary-900/20 dark:to-careGreen-900/20"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="card">
              <p className="text-xs text-slate-500">Medicine Compliance</p>
              <p className="text-2xl font-bold text-careGreen-600">94%</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-500">Recovery Score</p>
              <p className="text-2xl font-bold text-primary-600">82/100</p>
            </div>
            <div className="card col-span-2">
              <p className="text-xs text-slate-500 mb-2">Risk Status</p>
              <span className="badge-low">LOW RISK</span>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Project Overview (Roles) */}
      <section id="roles" className="bg-slate-50 dark:bg-slate-900/50 py-20">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">One system, three connected roles</h2>
          <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-12">
            An ESP32-based smart medicine box collects real-world signals — dose-taking, activity,
            emergencies — and AI models turn that into risk scores and recommendations doctors and
            caregivers can act on.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "Patient", desc: "Get reminders, track recovery, and chat with a safety-first AI assistant.", role: "patient" },
              { title: "Doctor", desc: "Monitor patient panels remotely, spot high-risk cases early.", role: "doctor" },
              { title: "Caregiver", desc: "Stay looped in on medicine, activity, and emergency alerts.", role: "caregiver" },
            ].map((r) => (
              <div key={r.title} className="card text-left flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-lg mb-2">{r.title}</h3>
                  <p className="text-slate-500 text-sm mb-4">{r.desc}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <button className="btn-primary text-xs flex-1" onClick={() => navigate(`/${r.role}/register`)}>Register</button>
                  <button className="btn-secondary text-xs flex-1" onClick={() => navigate(`/${r.role}/login`)}>Login</button>
                </div>
              </div>
            ))}
            {/* Admin Card */}
            <div className="card text-left flex flex-col justify-between md:col-span-3 lg:col-span-1 max-w-sm mx-auto w-full border-dashed border-2 border-slate-300 dark:border-slate-700 bg-transparent shadow-none mt-4 md:mt-0">
              <div>
                <h3 className="font-bold text-lg mb-2">System Admin</h3>
                <p className="text-slate-500 text-sm mb-4">Manage users, oversee hospital networks, and monitor system analytics.</p>
              </div>
              <div className="flex gap-2 mt-4">
                <button className="btn-primary text-xs flex-1 bg-slate-800 hover:bg-slate-900" onClick={() => navigate(`/admin/register`)}>Register</button>
                <button className="btn-secondary text-xs flex-1" onClick={() => navigate(`/admin/login`)}>Login</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Features built for real recovery</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            ["Medicine Adherence Tracking", "Automatic dose detection via load-cell weight change plus manual confirmation."],
            ["AI Recovery Risk Scoring", "XGBoost-driven Low / Medium / High risk classification updated continuously."],
            ["Anomaly Detection", "Isolation Forest flags unusual inactivity or repeated missed doses early."],
            ["Explainable Recommendations", "Decision Tree logic generates clear, actionable wellness guidance."],
            ["Emergency SOS", "One-press SOS button instantly alerts caregivers and doctors."],
            ["Safety-First AI Chat", "Local Gemma 3 model answers wellness questions — never diagnoses or prescribes."],
          ].map(([title, desc]) => (
            <div key={title} className="card">
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="bg-slate-50 dark:bg-slate-900/50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              ["1", "Discharge", "Patient goes home with a CareDock smart medicine box linked to their profile."],
              ["2", "Monitor", "ESP32 sensors track dose-taking, activity, and emergencies in real time."],
              ["3", "Analyze", "ML models compute recovery risk and detect anomalies continuously."],
              ["4", "Act", "Doctors and caregivers get alerts and recommendations before issues escalate."],
            ].map(([num, title, desc]) => (
              <div key={num} className="card text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold">
                  {num}
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-slate-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hardware Illustration */}
      <section id="hardware" className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Inside the Smart Medicine Box</h2>
        <p className="text-center text-slate-500 mb-12 max-w-2xl mx-auto">
          Built on an ESP32 WROOM, combining sensing, feedback, and connectivity in one compact device.
        </p>
        <div className="grid md:grid-cols-4 gap-4">
          {[
            "ESP32 WROOM (Wi-Fi controller)",
            "HX711 + Load Cell (dose detection)",
            "DS3231 RTC (accurate timing)",
            "OLED Display (status messages)",
            "Buzzer + RGB status LEDs",
            "Medicine Taken push button",
            "SOS emergency button",
            "PIR motion sensor (activity)",
          ].map((item) => (
            <div key={item} className="card text-sm font-medium text-slate-600 dark:text-slate-300">
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* AI Features */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">AI That Knows Its Limits</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold mb-2">Predictive risk models</h3>
              <p className="text-sm text-slate-500">
                XGBoost, Isolation Forest, and Decision Tree models work together to classify risk,
                catch anomalies, and explain recommendations — all trained on adherence and activity data.
              </p>
            </div>
            <div className="card">
              <h3 className="font-semibold mb-2">A chatbot that redirects, not diagnoses</h3>
              <p className="text-sm text-slate-500">
                The local Gemma 3 assistant explains medicines and discharge instructions, but is
                explicitly instructed to never diagnose or prescribe — always pointing patients back
                to their healthcare team for medical concerns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Previews */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">A dashboard for every role</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            ["Doctor Dashboard", "Patient panels, live alerts, high-risk flags, and AI recommendations at a glance."],
            ["Patient Dashboard", "Medicine reminders, recovery score, activity trends, and a safety-first AI assistant."],
            ["Caregiver Dashboard", "Real-time visibility into medicine, activity, and emergency alerts for loved ones."],
          ].map(([title, desc]) => (
            <div key={title} className="card">
              <div className="h-32 rounded-xl bg-gradient-to-br from-primary-100 to-careGreen-100 dark:from-primary-900/20 dark:to-careGreen-900/20 mb-4" />
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-slate-50 dark:bg-slate-900/50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Why it matters</h2>
          <div className="grid md:grid-cols-4 gap-6 text-center">
            {[
              ["30%", "Fewer missed doses"],
              ["Faster", "Emergency response via SOS"],
              ["Earlier", "Detection of recovery setbacks"],
              ["Continuous", "Doctor visibility without extra visits"],
            ].map(([stat, label]) => (
              <div key={label} className="card">
                <p className="text-3xl font-bold text-primary-600 mb-2">{stat}</p>
                <p className="text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="max-w-7xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">What early users say</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            ["Dr. Aditi Rao", "Cardiologist", "Having a clear risk signal for each discharged patient changes how I triage follow-up calls."],
            ["Karthik S.", "Caregiver", "The alerts gave me peace of mind when I couldn't be home during the day."],
            ["Meera P.", "Patient", "The reminders and gentle nudges helped me actually stick to my medicine schedule."],
          ].map(([name, role, quote]) => (
            <div key={name} className="card">
              <p className="text-sm text-slate-600 dark:text-slate-300 italic mb-4">"{quote}"</p>
              <p className="font-semibold text-sm">{name}</p>
              <p className="text-xs text-slate-400">{role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="bg-slate-50 dark:bg-slate-900/50 py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Want a demo?</h2>
          <p className="text-slate-500 mb-8">Reach out and we'll walk you through the full system, hardware included.</p>
          <div className="card text-left grid gap-4">
            <input className="border rounded-xl px-4 py-2 bg-transparent" placeholder="Your name" />
            <input className="border rounded-xl px-4 py-2 bg-transparent" placeholder="Email address" />
            <textarea className="border rounded-xl px-4 py-2 bg-transparent" rows={4} placeholder="Tell us about your use case" />
            <button className="btn-primary w-full">Send Message</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 dark:border-slate-800 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <p>© {new Date().getFullYear()} CareDock AI. Built for post-discharge care.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary-600">Privacy</a>
            <a href="#" className="hover:text-primary-600">Terms</a>
            <a href="#contact" className="hover:text-primary-600">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

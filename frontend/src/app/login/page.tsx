"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  ShieldCheck,
  Compass,
  Wind,
  CheckCircle2,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import { CycloneLogo } from "@/components/CycloneLogo";

interface UserProfile {
  name: string;
  email: string;
  role: string;
  roleTitle: string;
  badge: string;
  initials: string;
}

const DEMO_ROLES = [
  {
    id: "meteorologist",
    name: "Dr. Sarah Chen",
    email: "sarah.chen@cyclonet.org",
    role: "Lead Meteorologist",
    roleTitle: "SENIOR METEOROLOGIST",
    badge: "MET-01",
    initials: "SC",
    icon: Wind,
    color: "from-sky-500 to-blue-600",
  },
  {
    id: "officer",
    name: "Commander Alex Vance",
    email: "alex.vance@cyclonet.org",
    role: "Emergency Duty Officer",
    roleTitle: "DUTY OFFICER",
    badge: "OPS-04",
    initials: "AV",
    icon: ShieldCheck,
    color: "from-indigo-500 to-violet-600",
  },
  {
    id: "maritime",
    name: "Capt. Rajesh Kumar",
    email: "rajesh.kumar@cyclonet.org",
    role: "Maritime Commander",
    roleTitle: "MARITIME OPS",
    badge: "NAV-02",
    initials: "RK",
    icon: Compass,
    color: "from-teal-500 to-cyan-600",
  },
];

function UnifiedAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams?.get("mode") === "signup";

  const [isSignUp, setIsSignUp] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);

  // Form states
  const [signInEmail, setSignInEmail] = useState("");
  const [signInPassword, setSignInPassword] = useState("");

  const [signUpName, setSignUpName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpRole, setSignUpRole] = useState("Lead Meteorologist");

  useEffect(() => {
    setIsSignUp(searchParams?.get("mode") === "signup");
  }, [searchParams]);

  const togglePanel = (toSignUp: boolean) => {
    setIsSignUp(toSignUp);
    if (typeof window !== "undefined") {
      window.history.replaceState(
        null,
        "",
        toSignUp ? "/login?mode=signup" : "/login"
      );
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const initials = (signInEmail ? signInEmail.slice(0, 2).toUpperCase() : "OF");
      const userProfile: UserProfile = {
        name: signInEmail ? signInEmail.split("@")[0].replace(".", " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "Officer",
        email: signInEmail || "officer@cyclonet.org",
        role: "Emergency Duty Officer",
        roleTitle: "INVESTIGATOR",
        badge: "OPS-01",
        initials,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("cyclonet_user", JSON.stringify(userProfile));
        localStorage.setItem("cyclonet_auth_token", "demo-token-" + Date.now());
      }

      setAuthSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 700);
    }, 800);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const names = (signUpName || "New Officer").split(" ");
      const initials = names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : names[0].slice(0, 2).toUpperCase();

      const userProfile: UserProfile = {
        name: signUpName || "Officer",
        email: signUpEmail || "new.officer@cyclonet.org",
        role: signUpRole,
        roleTitle: signUpRole.toUpperCase(),
        badge: "USR-09",
        initials,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("cyclonet_user", JSON.stringify(userProfile));
        localStorage.setItem("cyclonet_auth_token", "demo-token-" + Date.now());
      }

      setAuthSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 700);
    }, 800);
  };

  const handleQuickDemoLogin = (role: typeof DEMO_ROLES[0]) => {
    setIsLoading(true);
    setSignInEmail(role.email);
    setSignInPassword("••••••••••••");

    setTimeout(() => {
      const userProfile: UserProfile = {
        name: role.name,
        email: role.email,
        role: role.role,
        roleTitle: role.roleTitle,
        badge: role.badge,
        initials: role.initials,
      };

      if (typeof window !== "undefined") {
        localStorage.setItem("cyclonet_user", JSON.stringify(userProfile));
        localStorage.setItem("cyclonet_auth_token", "demo-token-" + Date.now());
      }

      setAuthSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 600);
    }, 600);
  };

  return (
    <div className="auth-page-bg flex min-h-screen flex-col px-3 py-6 md:p-6 text-gray-800 selection:bg-blue-500/30 selection:text-white">
      {/* Top Bar Navigation */}
      <div className="w-full max-w-[920px] mx-auto mb-4 flex items-center justify-between px-2">
        <Link
          href="/landing-parallax"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-semibold backdrop-blur-md border border-white/10 transition-all group"
        >
          <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Landing</span>
        </Link>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            <CycloneLogo size={20} />
          </div>
          <span className="font-heading font-bold text-sm tracking-tight text-white/90">
            CycloNet <span className="text-sky-400 font-normal text-xs ml-1">Portal</span>
          </span>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`auth-wrapper m-auto w-full max-w-[920px] ${
          isSignUp ? "right-panel-active" : ""
        }`}
      >
        <div className={`auth-container ${isSignUp ? "right-panel-active" : ""}`}>
          
          {/* ============================================================== */}
          {/* Sign Up Form Panel (Left in DOM, animated in when active)      */}
          {/* ============================================================== */}
          <div className="auth-form-container sign-up-container flex flex-col justify-center overflow-y-auto">
            <div className="w-full text-center pt-2 pb-3 md:pt-4 px-2">
              <h2
                className="text-2xl md:text-[26px] font-bold text-slate-900 tracking-tight"
                style={{ fontFamily: "'Berkshire Swash', cursive, sans-serif", lineHeight: "1.25" }}
              >
                Join CycloNet Intelligence
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-sans">
                Real-time tropical cyclone tracking & satellite classification
              </p>
            </div>

            <form onSubmit={handleSignUpSubmit} className="space-y-3.5 mt-1">
              {/* Name */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    placeholder="Dr. Sarah Chen"
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Official Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="sarah.chen@cyclonet.org"
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              {/* Role Select */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Operational Role
                </label>
                <select
                  value={signUpRole}
                  onChange={(e) => setSignUpRole(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
                >
                  <option value="Lead Meteorologist">Lead Meteorologist (Radar & Swath)</option>
                  <option value="Emergency Duty Officer">Emergency Duty Officer (NDRF / State)</option>
                  <option value="Maritime Commander">Maritime Commander (Coast Guard / Navy)</option>
                  <option value="System Administrator">System Administrator (Model Weights & API)</option>
                </select>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Security Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0090FF] to-[#0070F3] hover:from-[#0080E5] hover:to-[#0060D9] text-white text-xs font-bold tracking-wide shadow-[0_4px_16px_rgba(0,144,255,0.35)] hover:shadow-[0_6px_22px_rgba(0,144,255,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Create Operational Account</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Mobile Switch Link */}
            <div className="relative w-full text-center md:hidden z-10 pt-4 pb-1">
              <button
                type="button"
                onClick={() => togglePanel(false)}
                className="text-xs text-slate-500 hover:text-slate-900 font-medium"
              >
                Already have an account?{" "}
                <span className="text-[#0090FF] font-bold">Sign In</span>
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* Sign In Form Panel (Default visible on Desktop)                */}
          {/* ============================================================== */}
          <div className="auth-form-container sign-in-container flex flex-col justify-center overflow-y-auto">
            <div className="w-full text-center pt-2 pb-2 md:pt-4 px-2">
              <h2
                className="text-2xl md:text-[28px] font-bold text-slate-900 tracking-tight"
                style={{ fontFamily: "'Berkshire Swash', cursive, sans-serif", lineHeight: "1.25" }}
              >
                Welcome back to CycloNet.
              </h2>
              <p className="text-xs text-slate-500 mt-1 font-sans">
                Sign in to your meteorological intelligence dashboard
              </p>
            </div>

            {/* Quick Demo Preset Chips */}
            <div className="w-full max-w-[360px] mx-auto mt-2 mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-sky-500" />
                  Quick Access Personas
                </span>
                <span className="text-[10px] text-slate-400">1-click test</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DEMO_ROLES.map((role) => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => handleQuickDemoLogin(role)}
                      className="p-1.5 rounded-lg border border-slate-200 hover:border-sky-500/50 bg-slate-50 hover:bg-sky-50/50 transition-all text-left flex flex-col items-center justify-center text-center group cursor-pointer"
                    >
                      <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-sky-500/20 to-blue-600/20 text-sky-600 group-hover:bg-sky-500 group-hover:text-white flex items-center justify-center transition-colors mb-1">
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-800 leading-tight truncate w-full">
                        {role.role.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="w-full max-w-[360px] mx-auto flex items-center gap-3 my-1.5">
              <div className="flex-1 h-[1px] bg-slate-200" />
              <span className="text-[10px] uppercase font-bold text-slate-400">or credentials</span>
              <div className="flex-1 h-[1px] bg-slate-200" />
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-3 mt-1">
              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="officer@cyclonet.org"
                    value={signInEmail}
                    onChange={(e) => setSignInEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    Password
                  </label>
                  <a href="#forgot" onClick={(e) => e.preventDefault()} className="text-[10px] font-semibold text-sky-600 hover:text-sky-700">
                    Forgot key?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••••••"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  id="remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                />
                <label htmlFor="remember" className="text-xs text-slate-600 font-medium cursor-pointer">
                  Remember this workstation
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0090FF] to-[#0070F3] hover:from-[#0080E5] hover:to-[#0060D9] text-white text-xs font-bold tracking-wide shadow-[0_4px_16px_rgba(0,144,255,0.35)] hover:shadow-[0_6px_22px_rgba(0,144,255,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Command Center</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Mobile Switch Link */}
            <div className="relative w-full text-center md:hidden z-10 pt-4 pb-1">
              <button
                type="button"
                onClick={() => togglePanel(true)}
                className="text-xs text-slate-500 hover:text-slate-900 font-medium"
              >
                Don&apos;t have an account?{" "}
                <span className="text-[#0090FF] font-bold">Sign Up</span>
              </button>
            </div>
          </div>

          {/* ============================================================== */}
          {/* Curved Sliding Overlay Container (Hidden on Mobile)            */}
          {/* ============================================================== */}
          <div className="auth-overlay-container">
            <div className="auth-overlay">

              {/* Left Overlay (Shown when user is Signing Up) */}
              <div className="auth-overlay-panel auth-overlay-left">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-4 shadow-lg">
                  <CycloneLogo size={28} />
                </div>

                <h2 className="text-3xl font-extrabold mb-3 text-white tracking-tight">
                  Ready for Operations?
                </h2>
                
                <p className="text-xs mb-8 px-6 text-white/85 leading-relaxed font-medium max-w-sm">
                  Access real-time meteorological radar, satellite classification, automated bulletins, and trajectory forecasting from one unified command center.
                </p>

                <button
                  type="button"
                  onClick={() => togglePanel(false)}
                  aria-label="Switch to sign in"
                  className="rounded-xl border-2 border-white/80 px-10 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white hover:text-slate-950 hover:border-white active:scale-95 transition-all duration-300 shadow-md cursor-pointer"
                >
                  Sign In
                </button>
              </div>

              {/* Right Overlay (Shown when user is Signing In) */}
              <div className="auth-overlay-panel auth-overlay-right">
                <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-4 shadow-lg">
                  <Sparkles className="w-6 h-6 text-sky-300 animate-pulse" />
                </div>

                <h2 className="text-3xl font-extrabold mb-3 text-white tracking-tight">
                  New Here?
                </h2>
                
                <p className="text-xs mb-8 px-6 text-white/85 leading-relaxed font-medium max-w-sm">
                  Create an operational profile to access advanced deep-learning storm analytics, wind swath modeling, and multi-agency early warnings.
                </p>

                <button
                  type="button"
                  onClick={() => togglePanel(true)}
                  aria-label="Switch to sign up"
                  className="rounded-xl border-2 border-white/80 px-10 py-2.5 text-xs font-bold text-white backdrop-blur-sm hover:bg-white hover:text-slate-950 hover:border-white active:scale-95 transition-all duration-300 shadow-md cursor-pointer"
                >
                  Sign Up
                </button>
              </div>

            </div>
          </div>

        </div>
      </motion.div>

      {/* Auth Success Overlay Modal */}
      <AnimatePresence>
        {authSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 border border-sky-500/30 rounded-2xl p-6 text-center max-w-sm w-full shadow-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">
                Access Granted
              </h3>
              <p className="text-xs text-slate-400">
                Initializing meteorological workspace & radar feeds...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#030712]">
          <span className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <UnifiedAuthContent />
    </Suspense>
  );
}

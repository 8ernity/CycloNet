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
import { SignIn, SignUp, useAuth } from "@clerk/nextjs";

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
  },
];

function UnifiedAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams?.get("mode") === "signup";
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (isLoaded && userId) {
      router.push("/");
    }
  }, [isLoaded, userId, router]);

  const [isSignUp, setIsSignUp] = useState(initialMode);
  const [resetKey, setResetKey] = useState(0);
  const [authSuccess, setAuthSuccess] = useState(false);

  useEffect(() => {
    setIsSignUp(searchParams?.get("mode") === "signup");
  }, [searchParams]);

  const togglePanel = (toSignUp: boolean) => {
    setResetKey((prev) => prev + 1);
    setIsSignUp(toSignUp);
    requestAnimationFrame(() => {
      window.history.replaceState(
        null,
        "",
        toSignUp ? "/login?mode=signup" : "/login"
      );
    });
  };

  const handleQuickDemoLogin = (role: typeof DEMO_ROLES[0]) => {
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
    }, 500);
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
          <div className="auth-form-container sign-up-container bg-white flex flex-col justify-center overflow-y-auto">
            <div className="w-full text-center pt-2 pb-1 md:pt-4 px-2">
              <h2
                className="text-2xl md:text-[26px] font-bold text-slate-900 tracking-tight"
                style={{ fontFamily: "'Berkshire Swash', cursive, sans-serif", lineHeight: "1.25" }}
              >
                Join CycloNet Intelligence
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-sans">
                Real-time tropical cyclone tracking & satellite classification
              </p>
            </div>

            {/* Clerk Sign Up Component */}
            <div className="flex h-full w-full items-center justify-center overflow-y-auto py-2">
              {isSignUp && (
                <SignUp
                  key={`signup-${resetKey}`}
                  appearance={{
                    elements: {
                      rootBox: "w-full flex justify-center",
                      card: "shadow-none border-0 m-0 w-full max-w-full bg-transparent",
                      footerAction: "hidden",
                      formButtonPrimary: "bg-gradient-to-r from-[#0090FF] to-[#0070F3] hover:from-[#0080E5] hover:to-[#0060D9] shadow-md",
                    },
                  }}
                  routing="hash"
                  signInUrl="/login"
                  fallbackRedirectUrl="/"
                  forceRedirectUrl="/"
                />
              )}
            </div>

            {/* Mobile Switch Link */}
            <div className="relative w-full text-center md:hidden z-10 pt-2 pb-1">
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
          <div className="auth-form-container sign-in-container bg-white flex flex-col justify-center overflow-y-auto">
            <div className="w-full text-center pt-2 pb-1 md:pt-4 px-2">
              <h2
                className="text-2xl md:text-[28px] font-bold text-slate-900 tracking-tight"
                style={{ fontFamily: "'Berkshire Swash', cursive, sans-serif", lineHeight: "1.25" }}
              >
                Welcome back to CycloNet.
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-sans">
                Sign in with Google, GitHub, or your operational credentials
              </p>
            </div>

            {/* Quick Demo Preset Chips */}
            <div className="w-full max-w-[360px] mx-auto mt-2 mb-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-sky-500" />
                  Quick Access Personas
                </span>
                <span className="text-[10px] text-slate-400">1-click bypass</span>
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
                      <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-sky-500/20 to-blue-600/20 text-sky-600 group-hover:bg-sky-500 group-hover:text-white flex items-center justify-center transition-colors mb-0.5">
                        <Icon className="w-3 h-3" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-800 leading-tight truncate w-full">
                        {role.role.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Clerk Sign In Component */}
            <div className="flex h-full w-full items-center justify-center overflow-y-auto py-1">
              {!isSignUp && (
                <SignIn
                  key={`signin-${resetKey}`}
                  appearance={{
                    elements: {
                      rootBox: "w-full flex justify-center",
                      card: "shadow-none border-0 m-0 w-full max-w-full bg-transparent",
                      footerAction: "hidden",
                      formButtonPrimary: "bg-gradient-to-r from-[#0090FF] to-[#0070F3] hover:from-[#0080E5] hover:to-[#0060D9] shadow-md",
                    },
                  }}
                  routing="hash"
                  signUpUrl="/login?mode=signup"
                  fallbackRedirectUrl="/"
                  forceRedirectUrl="/"
                />
              )}
            </div>

            {/* Mobile Switch Link */}
            <div className="relative w-full text-center md:hidden z-10 pt-2 pb-1">
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

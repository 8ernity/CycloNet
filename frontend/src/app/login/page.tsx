'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SignIn, SignUp, useAuth } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { motion } from 'framer-motion';

function UnifiedAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams?.get('mode') === 'signup';
  const { isLoaded, userId } = useAuth();

  useEffect(() => {
    if (isLoaded && userId) {
      window.location.href = '/dashboard';
    }
  }, [isLoaded, userId]);

  const [isSignUp, setIsSignUp] = useState(initialMode);
  const [resetKey, setResetKey] = useState(0);

  const togglePanel = (toSignUp: boolean) => {
    // Increment key to force Clerk to re-mount with a fresh state
    setResetKey(prev => prev + 1);
    setIsSignUp(toSignUp);

    // Clear Clerk's hash state so it doesn't resume a stale flow
    requestAnimationFrame(() => {
      window.history.replaceState(
        null,
        '',
        toSignUp ? '/login?mode=signup' : '/login'
      );
    });
  };

  useEffect(() => {
    setIsSignUp(searchParams?.get('mode') === 'signup');
  }, [searchParams]);

  return (
    <div className="auth-page-bg flex min-h-screen flex-col px-2 py-8 md:p-4 text-white">

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={`auth-wrapper m-auto w-full max-w-[920px] ${isSignUp ? 'right-panel-active' : ''}`}
      >

        <div className={`auth-container ${isSignUp ? 'right-panel-active' : ''}`}>

          {/* Sign Up Panel */}
          <div className="auth-form-container sign-up-container bg-[#080c18] flex flex-col">
            <div className="w-full text-center pt-2 pb-2 md:pt-6 px-4">
              <p className="text-xl md:text-2xl pt-2 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'Berkshire Swash', cursive", lineHeight: "1.3" }}>
                Join the future of cyclone intelligence — smarter, faster, safer.
              </p>
            </div>
            <div className="flex h-full w-full items-center justify-center overflow-y-auto">
              {isSignUp && (
                <SignUp
                  key={`signup-${resetKey}`}
                  appearance={{
                    theme: dark,
                    elements: {
                      rootBox: "w-full flex justify-center",
                      card: "shadow-none border-0 m-0 w-full max-w-full bg-transparent",
                      footerAction: "hidden"
                    }
                  }}
                  routing="hash"
                  signInUrl="/login"
                  fallbackRedirectUrl="/dashboard"
                  forceRedirectUrl="/dashboard"
                />
              )}
            </div>
            {/* Mobile toggle link */}
            <div className="relative w-full text-center md:hidden z-10 pb-4 pt-2">
              <button
                type="button"
                onClick={() => togglePanel(false)}
                className="text-sm text-slate-400 hover:text-white font-medium transition-colors"
              >
                Already have an account? <span className="text-sky-400 font-semibold underline underline-offset-2">Sign In</span>
              </button>
            </div>
          </div>

          {/* Sign In Panel */}
          <div className="auth-form-container sign-in-container bg-[#080c18] flex flex-col">
            <div className="w-full text-center pt-2 pb-2 md:pt-4 px-4">
              <p className="text-2xl md:text-3xl pt-5 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'Berkshire Swash', cursive", lineHeight: "1.3" }}>
                Welcome back to smarter<br />weather intelligence.
              </p>
            </div>
            <div className="flex h-full w-full items-center justify-center overflow-y-auto">
              {!isSignUp && (
                <SignIn
                  key={`signin-${resetKey}`}
                  appearance={{
                    theme: dark,
                    elements: {
                      rootBox: "w-full flex justify-center",
                      card: "shadow-none border-0 m-0 w-full max-w-full bg-transparent",
                      footerAction: "hidden"
                    }
                  }}
                  routing="hash"
                  signUpUrl="/login?mode=signup"
                  fallbackRedirectUrl="/dashboard"
                  forceRedirectUrl="/dashboard"
                />
              )}
            </div>
            {/* Mobile toggle link */}
            <div className="relative w-full text-center md:hidden z-10 pb-4 pt-2">
              <button
                type="button"
                onClick={() => togglePanel(true)}
                className="text-sm text-slate-400 hover:text-white font-medium transition-colors"
              >
                Don&apos;t have an account? <span className="text-sky-400 font-semibold underline underline-offset-2">Sign Up</span>
              </button>
            </div>
          </div>

          {/* Overlay Container (Hidden on mobile) */}
          <div className="auth-overlay-container">
            <div className="auth-overlay">

              {/* Left Overlay (Shown when signing up) */}
              <div className="auth-overlay-panel auth-overlay-left">
                <h2 className="text-3xl font-bold mb-4 text-white drop-shadow-md">Ready for Operations?</h2>
                <p className="text-sm mb-8 px-4 text-slate-200 leading-relaxed drop-shadow-sm">
                  Access meteorological radar feeds, storm trajectory forecasting, satellite analytics, and automated early warnings from one unified platform.
                </p>
                <button
                  type="button"
                  onClick={() => togglePanel(false)}
                  aria-label="Switch to sign in"
                  className="rounded-xl border border-white/40 bg-white/10 px-12 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white hover:text-slate-950 hover:border-white active:scale-95 transition-all duration-300 cursor-pointer shadow-lg shadow-black/40"
                >
                  Sign In
                </button>
              </div>

              {/* Right Overlay (Shown when signing in) */}
              <div className="auth-overlay-panel auth-overlay-right">
                <h2 className="text-3xl font-bold mb-4 text-white drop-shadow-md">New Here?</h2>
                <p className="text-sm mb-8 px-4 text-slate-200 leading-relaxed drop-shadow-sm">
                  Create an account to access advanced storm analytics, satellite classification, and live trajectory tracking.
                </p>
                <button
                  type="button"
                  onClick={() => togglePanel(true)}
                  aria-label="Switch to sign up"
                  className="rounded-xl border border-white/40 bg-white/10 px-12 py-3 text-sm font-semibold text-white backdrop-blur-md hover:bg-white hover:text-slate-950 hover:border-white active:scale-95 transition-all duration-300 cursor-pointer shadow-lg shadow-black/40"
                >
                  Sign Up
                </button>
              </div>

            </div>
          </div>

        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#030712]">
          <span className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></span>
        </div>
      }
    >
      <UnifiedAuthPage />
    </React.Suspense>
  );
}


"use client";

import React, { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { setAuthTokenProvider } from "@/lib/api";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ChatbotWidget } from "@/components/ChatbotWidget";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenProvider(getToken);
    return () => setAuthTokenProvider(null);
  }, [getToken]);
  const pathname = usePathname();
  const contentRef = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo({top:0, left:0, behavior:"instant"});
    contentRef.current?.scrollTo({top:0, left:0, behavior:"instant"});
  }, [pathname]);
  const isAuthPage = pathname === "/login" || pathname === "/signup";
  const isFullScreenPage = pathname === "/";

  if (isAuthPage) {
    return <div className="min-h-screen w-full">{children}</div>;
  }

  if (isFullScreenPage) {
    return (
      <div className="min-h-screen w-full bg-bg-base text-text-primary">
        {children}
        <ChatbotWidget />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground">
        Skip to main content
      </a>
      <Sidebar />
      <div className="min-w-0 w-full flex-1 lg:pl-64 flex flex-col min-h-screen">
        <Header />
        <main id="main-content" tabIndex={-1} ref={contentRef} className="min-w-0 flex-1 p-4 sm:p-6 overflow-x-clip">
          {children}
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}

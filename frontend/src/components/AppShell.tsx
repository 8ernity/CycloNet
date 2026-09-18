"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { ChatbotWidget } from "@/components/ChatbotWidget";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreenPage = pathname === "/landing-parallax";

  if (isFullScreenPage) {
    return (
      <div className="min-h-screen w-full bg-[#05070d]">
        {children}
        <ChatbotWidget />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}

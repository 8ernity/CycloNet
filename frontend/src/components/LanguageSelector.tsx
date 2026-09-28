"use client";

import React, { useState, useRef, useEffect } from "react";
import { Globe, Check } from "lucide-react";
import { useLanguage, SUPPORTED_LANGUAGES, SupportedLanguage } from "@/context/LanguageContext";

export function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentOption = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/[0.04] dark:bg-white/[0.06] border border-border hover:bg-slate-900/[0.08] dark:hover:bg-white/[0.1] text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs"
        title="Change Platform & Emergency Alert Language"
      >
        <Globe className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="font-bold">{currentOption.nativeName}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl bg-background/95 backdrop-blur-2xl border border-border shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60 mb-1">
            Regional Alert Language
          </div>
          <div className="space-y-0.5">
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => {
                  setLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  language === lang.code
                    ? "bg-primary/15 text-primary font-bold"
                    : "text-foreground hover:bg-secondary"
                }`}
              >
                <div className="flex flex-col text-left">
                  <span className="font-semibold text-xs leading-tight">{lang.nativeName}</span>
                  <span className="text-[10px] text-muted-foreground">{lang.name}</span>
                </div>
                {language === lang.code && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

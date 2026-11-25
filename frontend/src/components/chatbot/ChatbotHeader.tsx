"use client";

import React from "react";
import { GripHorizontal, Maximize2, Minimize2, MoreHorizontal, RotateCcw, X } from "lucide-react";
import { CycloneLogo } from "@/components/CycloneLogo";

interface ChatbotHeaderProps {
  isMinimized: boolean;
  isMenuOpen: boolean;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  onToggleMenu: () => void;
  onClear: () => void;
  onToggleMinimize: () => void;
  onClose: () => void;
}

export function ChatbotHeader({
  isMinimized,
  isMenuOpen,
  onDragStart,
  onToggleMenu,
  onClear,
  onToggleMinimize,
  onClose,
}: ChatbotHeaderProps) {
  return (
    <div
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      className="chat-drag-handle p-3.5 px-5 bg-zinc-950/50 border-b border-white/10 flex items-center justify-between relative select-none shrink-0"
      title="Click and drag to move chat window"
    >
      <div className="flex items-center gap-3 pointer-events-none select-none">
        <div className="relative">
          <CycloneLogo size={32} />
        </div>
        <div>
          <h3 className="font-heading font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
            <span>CycloNet AI</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-primary/20 text-primary border border-primary/30">
              Research
            </span>
          </h3>
          <p className="text-[11px] text-zinc-400">Education and source status</p>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-0.5 text-zinc-500 hover:text-zinc-300 transition-colors pointer-events-none">
        <GripHorizontal className="w-4 h-4 opacity-60" aria-hidden="true" />
      </div>

      <div className="flex items-center gap-1.5 relative">
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu();
            }}
            title="More Options"
            aria-label="More chat options"
            aria-expanded={isMenuOpen}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden py-1 z-50 text-xs">
              <button
                type="button"
                onClick={onClear}
                className="w-full text-left px-3.5 py-2 text-zinc-300 hover:bg-white/10 flex items-center gap-2 cursor-pointer transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>New Conversation</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleMinimize();
          }}
          title={isMinimized ? "Maximize" : "Minimize"}
          aria-label={isMinimized ? "Maximize assistant window" : "Minimize assistant window"}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          {isMinimized ? <Maximize2 className="w-4 h-4" aria-hidden="true" /> : <Minimize2 className="w-4 h-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close Assistant"
          aria-label="Close CycloNet AI assistant"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

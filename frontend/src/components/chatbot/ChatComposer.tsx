"use client";

import React from "react";
import { Mic, MicOff, Send, Sparkles } from "lucide-react";

interface ChatComposerProps {
  input: string;
  loading: boolean;
  isListening: boolean;
  voiceNotice: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onToggleVoice: () => void;
}

export function ChatComposer({
  input,
  loading,
  isListening,
  voiceNotice,
  inputRef,
  onInputChange,
  onSend,
  onToggleVoice,
}: ChatComposerProps) {
  return (
    <div className="p-4 border-t border-white/10 bg-zinc-950/50 backdrop-blur-md space-y-2">
      {voiceNotice && (
        <div role="status" className="text-[11px] text-amber-300 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
          {voiceNotice}
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-full bg-zinc-900/80 border border-white/15 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 px-4 py-2.5 shadow-inner transition-all">
        <Sparkles className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />

        <input
          ref={inputRef}
          aria-label="Message CycloNet AI"
          type="text"
          value={input}
          maxLength={3000}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Ask me anything about cyclones..."
          className="min-w-0 flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-zinc-400 leading-normal"
        />

        <button
          type="button"
          onClick={onToggleVoice}
          title={isListening ? "Listening... Click to stop" : "Voice Input (Speak to CycloNet AI)"}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
          aria-pressed={isListening}
          className={`p-1.5 rounded-full transition-all cursor-pointer ${
            isListening
              ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse scale-110"
              : "text-zinc-400 hover:text-white hover:bg-white/10"
          }`}
        >
          {isListening ? <MicOff className="w-4 h-4 text-rose-400" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
        </button>

        <button
          type="button"
          onClick={onSend}
          disabled={!input.trim() || loading}
          className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md shadow-blue-500/25 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105"
          title="Send Message"
          aria-label="Send message"
        >
          <Send className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

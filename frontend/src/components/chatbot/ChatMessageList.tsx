"use client";

import React from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Copy } from "lucide-react";
import { CycloneLogo } from "@/components/CycloneLogo";
import { formatChatContent } from "./ChatMarkdown";
import { CHAT_FEATURE_CARDS, ChatMessage } from "./types";

interface ChatMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  copyStatus: string;
  copiedId: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onSelectPrompt: (query: string) => void;
  onCopyMessage: (content: string, id: string) => void;
}

export function ChatMessageList({
  messages,
  loading,
  copyStatus,
  copiedId,
  messagesEndRef,
  onSelectPrompt,
  onCopyMessage,
}: ChatMessageListProps) {
  return (
    <div className="flex-1 p-5 overflow-y-auto space-y-4 scrollbar-thin bg-transparent">
      <div role="status" aria-live="polite" aria-atomic="true" className={copyStatus ? "text-xs text-foreground" : "sr-only"}>
        {copyStatus}
      </div>

      {messages.length === 0 ? (
        <div className="flex flex-col items-center text-center py-2 animate-in fade-in duration-300">
          <div className="relative my-3 flex items-center justify-center">
            <div className="absolute w-28 h-28 rounded-full bg-blue-500/25 blur-2xl pointer-events-none" />
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center relative shadow-lg shadow-blue-500/10">
              <CycloneLogo size={54} />
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white mt-2 tracking-tight">
            Hi, I&apos;m{" "}
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">
              CycloNet AI
            </span>
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-sm">
            Educational explanations and backend source summaries.
          </p>

          <div className="flex items-center gap-3 my-4 w-full max-w-xs">
            <div className="h-px bg-white/10 flex-1" />
            <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
              No generated operational advice
            </span>
            <div className="h-px bg-white/10 flex-1" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md my-1 text-left">
            {CHAT_FEATURE_CARDS.map((card, idx) => {
              const Icon = card.icon;
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={() => onSelectPrompt(card.query)}
                  className="p-3.5 rounded-2xl bg-card/60 hover:bg-card border border-border hover:border-primary/40 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-xs hover:scale-[1.01]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${card.iconBg} group-hover:scale-105 transition-transform`}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-heading font-bold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                        {card.title}
                      </h4>
                      <p className="text-[10.5px] text-muted-foreground leading-tight truncate">{card.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text" className="space-y-4">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`group relative max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground font-semibold rounded-tr-sm shadow-md"
                    : "bg-card/90 border border-border text-foreground rounded-tl-sm shadow-xs"
                }`}
              >
                {formatChatContent(msg.content, msg.role === "user")}

                {msg.role === "assistant" && (
                  <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-mono">{msg.timestamp}</span>
                    <button
                      type="button"
                      aria-label={copiedId === msg.id ? "Copied" : "Copy"}
                      onClick={() => onCopyMessage(msg.content, msg.id)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" aria-hidden="true" />
                          <span className="text-emerald-500">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" aria-hidden="true" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1 px-1">
                  {msg.sources.map((src, sIdx) => (
                    <span
                      key={sIdx}
                      className="text-[9px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border font-mono"
                    >
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

          {loading && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-2">
              <div className="rounded-2xl rounded-tl-sm p-3 bg-card/90 border border-border flex items-center gap-1.5 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-primary animate-bounce" />
                <span className="text-[11px] text-muted-foreground font-mono ml-2">Preparing response…</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLiquidGlass } from "@/hooks/useLiquidGlass";
import { useClipboard } from "@/hooks/useClipboard";
import { getApiBaseUrl } from "@/lib/api";
import { readChatReply } from "@/lib/chatResponse";
import { ChatMessage } from "./chatbot/types";
import { useChatWindowLayout } from "./chatbot/useChatWindowLayout";
import { ChatbotHeader } from "./chatbot/ChatbotHeader";
import { ChatMessageList } from "./chatbot/ChatMessageList";
import { ChatComposer } from "./chatbot/ChatComposer";

function readSelectedCycloneContext(): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  let storedId: string | null = null;
  let storedName: string | null = null;
  try {
    storedId = window.localStorage.getItem("cyclonet_selected_cyclone_id");
    storedName = window.localStorage.getItem("cyclonet_selected_cyclone_name");
  } catch {
    // ignore storage access errors
  }
  return {
    page: window.location.pathname.slice(0, 80),
    selectedCycloneId: storedId,
    selectedCycloneName: storedName,
  };
}

export function ChatbotWidget() {
  const reduceMotion = useReducedMotion();
  const openerRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { copyText, copyStatus, copiedId, resetCopy } = useClipboard();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recognitionRef = useRef<CycloneSpeechRecognition | null>(null);
  const pendingRequest = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const glassRef = useLiquidGlass<HTMLDivElement>(isOpen);
  const {
    hasMounted,
    pos,
    size,
    isDragging,
    isResizing,
    handleDragStart,
    handleResizeStart,
    resizeBy,
  } = useChatWindowLayout(isMinimized);

  useEffect(
    () => () => {
      pendingRequest.current?.abort();
      pendingRequest.current = null;
      recognitionRef.current?.stop();
    },
    []
  );

  useEffect(() => {
    const handleExternalOpen = () => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener("cyclonet:open-chat", handleExternalOpen);
    return () => window.removeEventListener("cyclonet:open-chat", handleExternalOpen);
  }, []);

  useEffect(() => {
    if (!isOpen || isMinimized || !hasMounted) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, isMinimized, hasMounted]);

  useEffect(() => {
    if (isOpen && !isMinimized && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth" });
    }
  }, [messages, isOpen, isMinimized, loading, reduceMotion]);

  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice("Voice input is not supported in this browser.");
      return;
    }
    setVoiceNotice(null);

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join("");
        setInput(transcript);
      };
      recognition.onerror = (event) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Error starting speech recognition:", err);
      setIsListening(false);
    }
  };

  const closeAssistant = () => {
    setIsOpen(false);
    setIsMenuOpen(false);
    recognitionRef.current?.stop();
    setIsListening(false);
    openerRef.current?.focus();
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || pendingRequest.current) return;
    const controller = new AbortController();
    pendingRequest.current = controller;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput("");
    setLoading(true);

    let requestTimeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const historyPayload = messages.slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
      const uiContext = readSelectedCycloneContext();

      let fetchSignal: AbortSignal = controller.signal;
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.any === "function" && typeof AbortSignal.timeout === "function") {
        try {
          fetchSignal = AbortSignal.any([controller.signal, AbortSignal.timeout(65000)]);
        } catch {
          fetchSignal = controller.signal;
        }
      } else {
        requestTimeout = setTimeout(() => controller.abort(), 65000);
      }

      const res = await fetch(`${getApiBaseUrl()}/api/chat`, {
        method: "POST",
        signal: fetchSignal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: historyPayload, ui_context: uiContext }),
      });
      if (requestTimeout) clearTimeout(requestTimeout);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await readChatReply(res);
      if (pendingRequest.current !== controller) return;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.response || "No response received.",
          category: data.category,
          sources: data.sources,
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } catch (err) {
      if (requestTimeout) clearTimeout(requestTimeout);
      console.error("[ChatbotWidget Error]", err);
      if (pendingRequest.current !== controller) return;
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Source information is unavailable. Try again shortly; no current conditions or safety assessment can be established.",
          category: "error",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      if (pendingRequest.current === controller) {
        pendingRequest.current = null;
        setLoading(false);
      }
    }
  };

  const handleClear = () => {
    pendingRequest.current?.abort();
    pendingRequest.current = null;
    setLoading(false);
    setMessages([]);
    resetCopy();
    setIsMenuOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && hasMounted && (
        <motion.div
          ref={glassRef}
          role="dialog"
          aria-label="CycloNet AI assistant"
          aria-modal="false"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            if (isMenuOpen) setIsMenuOpen(false);
            else closeAssistant();
          }}
          initial={{ opacity: 0, scale: 0.9, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 15 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 26 }}
          style={{
            position: "fixed",
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            width: `${size.width}px`,
            height: isMinimized ? "64px" : `${size.height}px`,
            zIndex: 9999,
            touchAction: isDragging || isResizing ? "none" : "auto",
            cursor: isDragging ? "grabbing" : isResizing ? "nwse-resize" : "default",
            userSelect: isDragging || isResizing ? "none" : "auto",
            boxShadow:
              isDragging || isResizing ? "0 30px 70px rgba(0,0,0,0.7), 0 0 30px rgba(59,130,246,0.2)" : undefined,
          }}
          className="liquid-glass-panel flex flex-col rounded-[26px] overflow-hidden transition-[box-shadow,height] duration-200 relative border border-white/15"
        >
          <ChatbotHeader
            isMinimized={isMinimized}
            isMenuOpen={isMenuOpen}
            onDragStart={handleDragStart}
            onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
            onClear={handleClear}
            onToggleMinimize={() => setIsMinimized((prev) => !prev)}
            onClose={closeAssistant}
          />

          {!isMinimized && (
            <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
              <ChatMessageList
                messages={messages}
                loading={loading}
                copyStatus={copyStatus}
                copiedId={copiedId}
                messagesEndRef={messagesEndRef}
                onSelectPrompt={(query) => void handleSend(query)}
                onCopyMessage={(content, id) => void copyText(content, id)}
              />

              <ChatComposer
                input={input}
                loading={loading}
                isListening={isListening}
                voiceNotice={voiceNotice}
                inputRef={inputRef}
                onInputChange={setInput}
                onSend={() => void handleSend()}
                onToggleVoice={toggleVoiceInput}
              />

              <div
                role="button"
                tabIndex={0}
                aria-label="Resize chat window. Use arrow keys to adjust width and height."
                onMouseDown={handleResizeStart}
                onTouchStart={handleResizeStart}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 48 : 24;
                  if (e.key === "ArrowRight") resizeBy(step, 0);
                  else if (e.key === "ArrowLeft") resizeBy(-step, 0);
                  else if (e.key === "ArrowDown") resizeBy(0, step);
                  else if (e.key === "ArrowUp") resizeBy(0, -step);
                  else return;
                  e.preventDefault();
                }}
                className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 text-zinc-400 hover:text-white transition-colors z-30 select-none group"
                title="Drag or use arrow keys to resize chat window"
              >
                <svg className="w-3.5 h-3.5 group-hover:scale-125 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="21" y1="11" x2="11" y2="21" />
                  <line x1="21" y1="16" x2="16" y2="21" />
                </svg>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

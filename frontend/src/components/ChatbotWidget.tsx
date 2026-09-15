"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Bot, 
  X, 
  Send, 
  Minimize2, 
  Maximize2, 
  RotateCcw, 
  Sparkles, 
  Wind, 
  ShieldAlert, 
  Copy, 
  Check, 
  ChevronRight,
  ExternalLink,
  Radar,
  GripHorizontal
} from "lucide-react";
import { useLiquidGlass } from "@/hooks/useLiquidGlass";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  category?: string;
  sources?: string[];
  timestamp: string;
}

const QUICK_PROMPTS = [
  { label: "🌪️ Explain Dvorak Scale", query: "How does the Dvorak technique estimate cyclone intensity from satellite imagery?" },
  { label: "📊 IMD vs Saffir-Simpson", query: "What is the difference between the IMD cyclone classification and the Saffir-Simpson Hurricane scale?" },
  { label: "⚠️ Disaster Safety Tips", query: "What safety precautions and emergency steps should coastal residents take during a cyclone warning?" },
  { label: "📜 Cyclone Amphan Stats", query: "Tell me about Super Cyclone Amphan: its peak wind speed, pressure, and landfall." },
  { label: "🛰️ How CycloNet Works", query: "How does CycloNet's deep learning model classify satellite images and reject non-cyclone frames?" }
];

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [screenContext, setScreenContext] = useState<any>(null);

  // Sync live UI telemetry from window.__cyclonet_current_context
  useEffect(() => {
    const updateContext = () => {
      if (typeof window !== "undefined") {
        setScreenContext((window as any).__cyclonet_current_context || null);
      }
    };
    updateContext();
    const interval = setInterval(updateContext, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Dynamic context-aware suggestion prompts
  const activePrompts = screenContext?.activeSystem ? [
    { label: `🌪️ Tell me about this cyclone`, query: "Tell me about this cyclone." },
    { label: `📍 Where is it heading?`, query: `Where is ${screenContext.activeSystem.name} heading and when will it make landfall?` },
    { label: `💨 Analyze Wind & Category`, query: `Analyze the current intensity, category, and sustained winds of ${screenContext.activeSystem.name}.` },
    { label: `🌊 Storm Surge & Coastal Threat`, query: `What coastal impacts and storm surge are expected from ${screenContext.activeSystem.name}?` },
    { label: `📐 Satellite Dvorak Analysis`, query: `How is the Dvorak technique applied to estimate the intensity of ${screenContext.activeSystem.name}?` }
  ] : QUICK_PROMPTS;

  // Liquid Glass Background hook from nebula-map
  const glassRef = useLiquidGlass<HTMLDivElement>(isOpen);

  // Draggable position & resizable size state
  const [hasMounted, setHasMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 500, height: 700 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ clientX: 0, clientY: 0, width: 500, height: 700 });

  const SAFE_MARGIN = 16;

  // Initialize position & size on client mount
  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== "undefined") {
      // Restore or initialize size (larger default: 500x700)
      let initialWidth = Math.min(500, window.innerWidth - 32);
      let initialHeight = Math.min(700, window.innerHeight - 80);
      const savedSize = localStorage.getItem("cyclonet_chat_size_v3");
      if (savedSize) {
        try {
          const parsed = JSON.parse(savedSize);
          if (typeof parsed.width === "number" && typeof parsed.height === "number") {
            initialWidth = Math.max(380, Math.min(parsed.width, window.innerWidth - 32));
            initialHeight = Math.max(340, Math.min(parsed.height, window.innerHeight - 80));
          }
        } catch (_) {}
      }
      setSize({ width: initialWidth, height: initialHeight });

      // Restore or initialize position
      const savedPos = localStorage.getItem("cyclonet_chat_pos_v3");
      if (savedPos) {
        try {
          const parsed = JSON.parse(savedPos);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            const maxX = Math.max(SAFE_MARGIN, window.innerWidth - initialWidth - SAFE_MARGIN);
            const maxY = Math.max(SAFE_MARGIN, window.innerHeight - initialHeight - SAFE_MARGIN);
            setPos({
              x: Math.max(SAFE_MARGIN, Math.min(parsed.x, maxX)),
              y: Math.max(SAFE_MARGIN, Math.min(parsed.y, maxY))
            });
            return;
          }
        } catch (_) {}
      }
      // Default to right side above dock
      setPos({
        x: Math.max(SAFE_MARGIN, window.innerWidth - initialWidth - 24),
        y: Math.max(SAFE_MARGIN, window.innerHeight - initialHeight - 80)
      });
    }
  }, []);

  // Persist position and size when updated
  useEffect(() => {
    if (hasMounted && typeof window !== "undefined") {
      localStorage.setItem("cyclonet_chat_pos_v3", JSON.stringify(pos));
    }
  }, [pos, hasMounted]);

  useEffect(() => {
    if (hasMounted && typeof window !== "undefined") {
      localStorage.setItem("cyclonet_chat_size_v3", JSON.stringify(size));
    }
  }, [size, hasMounted]);

  // Listen for external open trigger (e.g. Header Ask AI button)
  useEffect(() => {
    const handleExternalOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener("cyclonet:open-chat", handleExternalOpen);
    return () => window.removeEventListener("cyclonet:open-chat", handleExternalOpen);
  }, []);

  // Handle window resizing
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      const currentHeight = isMinimized ? 56 : size.height;
      const maxX = Math.max(SAFE_MARGIN, window.innerWidth - size.width - SAFE_MARGIN);
      const maxY = Math.max(SAFE_MARGIN, window.innerHeight - currentHeight - SAFE_MARGIN);
      setPos(prev => ({
        x: Math.max(SAFE_MARGIN, Math.min(prev.x, maxX)),
        y: Math.max(SAFE_MARGIN, Math.min(prev.y, maxY))
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [size.width, size.height, isMinimized]);

  // Dragging event listeners
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ("button" in e && e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, textarea, input, a, [role='button']")) return;

    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    setIsDragging(true);
    setDragOffset({
      x: clientX - pos.x,
      y: clientY - pos.y
    });
  };

  // Resizing start listener
  const handleResizeStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    setIsResizing(true);
    setResizeStart({
      clientX,
      clientY,
      width: size.width,
      height: size.height
    });
  };

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const currentHeight = isMinimized ? 56 : size.height;
        const maxX = Math.max(SAFE_MARGIN, window.innerWidth - size.width - SAFE_MARGIN);
        const maxY = Math.max(SAFE_MARGIN, window.innerHeight - currentHeight - SAFE_MARGIN);

        const nextX = Math.max(SAFE_MARGIN, Math.min(e.clientX - dragOffset.x, maxX));
        const nextY = Math.max(SAFE_MARGIN, Math.min(e.clientY - dragOffset.y, maxY));
        setPos({ x: nextX, y: nextY });
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStart.clientX;
        const deltaY = e.clientY - resizeStart.clientY;
        const maxAllowedW = window.innerWidth - pos.x - SAFE_MARGIN;
        const maxAllowedH = window.innerHeight - pos.y - SAFE_MARGIN;

        const newW = Math.max(380, Math.min(resizeStart.width + deltaX, maxAllowedW));
        const newH = Math.max(340, Math.min(resizeStart.height + deltaY, maxAllowedH));
        setSize({ width: newW, height: newH });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      if (isDragging) {
        const currentHeight = isMinimized ? 56 : size.height;
        const maxX = Math.max(SAFE_MARGIN, window.innerWidth - size.width - SAFE_MARGIN);
        const maxY = Math.max(SAFE_MARGIN, window.innerHeight - currentHeight - SAFE_MARGIN);

        const nextX = Math.max(SAFE_MARGIN, Math.min(e.touches[0].clientX - dragOffset.x, maxX));
        const nextY = Math.max(SAFE_MARGIN, Math.min(e.touches[0].clientY - dragOffset.y, maxY));
        setPos({ x: nextX, y: nextY });
      } else if (isResizing) {
        const deltaX = e.touches[0].clientX - resizeStart.clientX;
        const deltaY = e.touches[0].clientY - resizeStart.clientY;
        const maxAllowedW = window.innerWidth - pos.x - SAFE_MARGIN;
        const maxAllowedH = window.innerHeight - pos.y - SAFE_MARGIN;

        const newW = Math.max(380, Math.min(resizeStart.width + deltaX, maxAllowedW));
        const newH = Math.max(340, Math.min(resizeStart.height + deltaY, maxAllowedH));
        setSize({ width: newW, height: newH });
      }
    };

    const handleEnd = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, size.width, size.height, isMinimized, pos.x, pos.y]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      role: "assistant",
      content: "### 🌪️ Welcome to CycloNet AI Assistant!\n\nI am your specialized meteorological intelligence companion. Powered by **Google Gemini 3.6 Flash** and CycloNet's meteorological knowledge base, I can help you with:\n\n- **Tropical cyclogenesis** and atmospheric physics (SST, shear, Coriolis)\n- **Dvorak T-number** satellite intensity analysis\n- **IMD & Saffir-Simpson** scale interpretations\n- **Disaster safety protocols** and storm surge dynamics\n- **Historical storm telemetry** (Amphan, Biparjoy, Tauktae)\n\nAsk any question or select a quick topic below to get started!",
      category: "welcome",
      sources: ["CycloNet Meteorological Knowledge Base", "IMD & WMO Standards"],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized, loading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const historyPayload = messages
        .filter(m => m.id !== "welcome-1")
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      
      // Capture live interface context at time of message send
      let uiContext: any = null;
      if (typeof window !== "undefined") {
        const stored = (window as any).__cyclonet_current_context;
        uiContext = {
          pathname: window.location.pathname,
          search: window.location.search,
          ...(stored || {})
        };
      }

      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: historyPayload,
          ui_context: uiContext
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "No response received.",
        category: data.category,
        sources: data.sources,
        timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⚠️ **Connection Notice:** Unable to reach the meteorological intelligence backend. Please ensure the backend server is active at `http://localhost:8000`.",
          category: "error",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClear = () => {
    setMessages([
      {
        id: Date.now().toString(),
        role: "assistant",
        content: "Conversation history cleared. How else can I assist your meteorological analysis today?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  const formatContent = (text: string, isUser: boolean = false) => {
    return text.split("\n").map((line, idx) => {
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className={`font-heading font-bold text-sm mt-3 mb-1.5 flex items-center gap-1.5 ${isUser ? "text-zinc-950 font-black" : "text-white"}`}>
            {line.replace("### ", "")}
          </h4>
        );
      }
      if (line.startsWith("#### ")) {
        return (
          <h5 key={idx} className={`font-semibold text-xs mt-2 mb-1 ${isUser ? "text-zinc-900 font-bold" : "text-zinc-200"}`}>
            {line.replace("#### ", "")}
          </h5>
        );
      }
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        const bulletText = line.trim().substring(2);
        return (
          <div key={idx} className={`flex items-start gap-2 ml-1 my-1 text-xs leading-relaxed ${isUser ? "text-zinc-950 font-medium" : "text-zinc-300"}`}>
            <span className={isUser ? "text-zinc-900 mt-1 text-[8px]" : "text-zinc-400 mt-1 text-[8px]"}>•</span>
            <span>{renderFormattedInline(bulletText, isUser)}</span>
          </div>
        );
      }
      if (/^\d+\.\s/.test(line.trim())) {
        const match = line.trim().match(/^(\d+\.)\s(.*)$/);
        if (match) {
          return (
            <div key={idx} className={`flex items-start gap-2 ml-1 my-1 text-xs leading-relaxed ${isUser ? "text-zinc-950 font-medium" : "text-zinc-300"}`}>
              <span className={`font-mono text-xs ${isUser ? "text-zinc-900 font-bold" : "text-zinc-400"}`}>{match[1]}</span>
              <span>{renderFormattedInline(match[2], isUser)}</span>
            </div>
          );
        }
      }
      if (line.trim().startsWith("|---")) {
        return null;
      }
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        const cells = line.split("|").filter((_, i, arr) => i > 0 && i < arr.length - 1);
        return (
          <div key={idx} className={`grid grid-cols-4 gap-1 py-1 px-1.5 text-[11px] border-b border-border/40 font-mono ${isUser ? "text-zinc-950" : ""}`}>
            {cells.map((cell, cIdx) => (
              <span key={cIdx} className={cIdx === 0 ? (isUser ? "font-bold text-zinc-950" : "font-semibold text-white") : (isUser ? "text-zinc-850 truncate" : "text-zinc-400 truncate")}>
                {cell.trim().replace(/\$/g, "")}
              </span>
            ))}
          </div>
        );
      }
      if (!line.trim()) {
        return <div key={idx} className="h-1.5" />;
      }
      return (
        <p key={idx} className={`text-xs my-1 leading-relaxed ${isUser ? "text-zinc-950 font-semibold" : "text-zinc-200"}`}>
          {renderFormattedInline(line, isUser)}
        </p>
      );
    });
  };

  const renderFormattedInline = (str: string, isUser: boolean = false) => {
    const parts = str.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, pIdx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={pIdx} className={isUser ? "font-bold text-zinc-950" : "font-semibold text-white"}>{part.slice(2, -2)}</strong>;
      }
      const codeParts = part.split(/(`.*?`)/g);
      return codeParts.map((sub, sIdx) => {
        if (sub.startsWith("`") && sub.endsWith("`")) {
          return (
            <code key={sIdx} className={`px-1 py-0.5 rounded font-mono text-[11px] ${isUser ? "bg-zinc-200 text-zinc-950 font-bold" : "bg-white/10 text-zinc-100"}`}>
              {sub.slice(1, -1)}
            </code>
          );
        }
        return sub;
      });
    });
  };

  return (
    <>
      {/* Floating Chat Window with Liquid Glass, Dragging and Resizing */}
      <AnimatePresence>
        {isOpen && hasMounted && (
          <motion.div
            ref={glassRef}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 26 }}
            style={{
              position: "fixed",
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              width: `${size.width}px`,
              height: isMinimized ? "56px" : `${size.height}px`,
              zIndex: 9999,
              touchAction: (isDragging || isResizing) ? "none" : "auto",
              cursor: isDragging ? "grabbing" : isResizing ? "nwse-resize" : "default",
              userSelect: (isDragging || isResizing) ? "none" : "auto",
              boxShadow: (isDragging || isResizing)
                ? "0 30px 70px rgba(0,0,0,0.6), 0 0 30px rgba(255,255,255,0.12)" 
                : undefined
            }}
            className="liquid-glass-panel flex flex-col rounded-2xl overflow-hidden transition-[box-shadow,height] duration-200 relative"
          >
            {/* Drag Handle & Header */}
            <div 
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="chat-drag-handle p-3.5 px-4 bg-zinc-950/40 border-b border-white/10 flex items-center justify-between relative select-none"
              title="Click and drag to move chat window"
            >
              <div className="flex items-center gap-2.5 pointer-events-none select-none">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white shadow-inner">
                    <Bot className="w-4 h-4" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-heading font-semibold text-xs text-zinc-100 tracking-tight">CycloNet AI</h3>
                    <span className="px-1.5 py-0.2 text-[8.5px] font-mono rounded bg-white/10 text-zinc-300 border border-white/15 font-medium">
                      Gemini 3.6
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    {screenContext?.activeSystem ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span className="text-amber-300 font-medium truncate max-w-[200px]">
                          Active: {screenContext.activeSystem.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>Meteorological Intelligence</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Drag Grip Indicator */}
              <div className="hidden sm:flex items-center gap-0.5 text-zinc-500 hover:text-zinc-300 transition-colors pointer-events-none">
                <GripHorizontal className="w-4 h-4" />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                  title="Clear Conversation"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}
                  title={isMinimized ? "Maximize" : "Minimize"}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                >
                  {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  title="Close Assistant"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Body Content (Hidden when minimized) */}
            {!isMinimized && (
              <>
                {/* Message Scroll Area */}
                <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin bg-transparent">
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
                            ? "bg-white text-zinc-950 font-semibold rounded-tr-sm shadow-md"
                            : "bg-zinc-900/60 border border-white/15 text-zinc-100 rounded-tl-sm shadow-sm"
                        }`}
                      >
                        {formatContent(msg.content, msg.role === "user")}

                        {/* Copy button on assistant answers */}
                        {msg.role === "assistant" && (
                          <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="font-mono">{msg.timestamp}</span>
                            <button
                              onClick={() => handleCopy(msg.content, msg.id)}
                              className="flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-500" />
                                  <span className="text-emerald-500">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Source Citation Badges */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 px-1">
                          {msg.sources.map((src, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[9px] px-2 py-0.5 rounded-full bg-white/[0.08] text-muted-foreground border border-white/15 font-mono"
                            >
                              📚 {src}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ))}

                  {/* Typing Indicator */}
                  {loading && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2"
                    >
                      <div className="rounded-2xl rounded-tl-sm p-3 bg-zinc-900/60 border border-white/15 flex items-center gap-1.5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce" />
                        <span className="text-[11px] text-muted-foreground font-mono ml-2">
                          Reasoning...
                        </span>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Suggestion Pills */}
                {messages.length <= 3 && !loading && (
                  <div className="px-3 py-2 border-t border-white/10 bg-white/[0.02] flex flex-wrap gap-1.5 overflow-x-auto scrollbar-none">
                    {activePrompts.map((p, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(p.query)}
                        className="text-[11px] px-2.5 py-1 rounded-full bg-white/[0.08] hover:bg-white/20 hover:text-white border border-white/15 transition-all text-zinc-200 whitespace-nowrap shadow-xs flex items-center gap-1"
                      >
                        {p.label}
                        <ChevronRight className="w-3 h-3 opacity-50" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Input Bar */}
                <div className="p-3 border-t border-white/15 bg-zinc-950/40 relative">
                  <div className="flex items-center gap-2 rounded-xl bg-white/[0.05] border border-white/15 focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/10 px-3 py-1.5 transition-all">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Ask any question about cyclones, Dvorak scale, safety..."
                      rows={1}
                      className="flex-1 bg-transparent border-none outline-none resize-none text-xs text-foreground placeholder:text-muted-foreground/70 max-h-24 py-1.5 leading-relaxed"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || loading}
                      className="p-2 rounded-lg bg-zinc-100 text-zinc-950 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-all shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-muted-foreground">
                    <span>Press <kbd className="px-1 py-0.5 rounded bg-white/10 text-[9px] font-mono">Enter</kbd> to send</span>
                    <span className="font-mono text-zinc-400">Google Gemini 3.6 Flash</span>
                  </div>
                </div>

                {/* Corner Resize Handle */}
                <div
                  onMouseDown={handleResizeStart}
                  onTouchStart={handleResizeStart}
                  className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 text-zinc-400 hover:text-white transition-colors z-30 select-none group"
                  title="Drag to resize chat window"
                >
                  <svg className="w-3.5 h-3.5 group-hover:scale-125 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="21" y1="11" x2="11" y2="21" />
                    <line x1="21" y1="16" x2="16" y2="21" />
                  </svg>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

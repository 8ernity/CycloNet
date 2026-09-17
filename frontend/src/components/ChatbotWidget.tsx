"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Send, 
  Minimize2, 
  Maximize2, 
  RotateCcw, 
  Sparkles, 
  Cloud,
  Satellite,
  BarChart3,
  ShieldCheck,
  ChevronRight,
  Mic,
  MicOff,
  MoreHorizontal,
  Copy, 
  Check, 
  GripHorizontal
} from "lucide-react";
import { useLiquidGlass } from "@/hooks/useLiquidGlass";
import { CycloneLogo } from "@/components/CycloneLogo";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  category?: string;
  sources?: string[];
  timestamp: string;
}

const FEATURE_CARDS = [
  {
    title: "Tropical Cyclogenesis",
    desc: "Track and understand cyclone formation",
    icon: Cloud,
    color: "blue",
    iconBg: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    query: "Explain tropical cyclogenesis: how warm sea surface temperatures, low vertical wind shear, and Coriolis force trigger cyclone formation in the North Indian Ocean."
  },
  {
    title: "Dvorak T-number",
    desc: "Estimate cyclone intensity",
    icon: Satellite,
    color: "rose",
    iconBg: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    query: "How does the Dvorak technique estimate tropical cyclone intensity and T-numbers from INSAT-3D satellite cloud patterns?"
  },
  {
    title: "IMD & Saffir-Simpson",
    desc: "Compare and interpret scales",
    icon: BarChart3,
    color: "purple",
    iconBg: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    query: "Compare the IMD 3-minute sustained wind classification (Depression to Super Cyclone) with the Saffir-Simpson Hurricane Wind Scale."
  },
  {
    title: "Disaster Safety",
    desc: "Stay informed and prepared",
    icon: ShieldCheck,
    color: "emerald",
    iconBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    query: "What are the essential disaster safety protocols, coastal evacuation guidelines, and emergency precautions during an active cyclone warning?"
  }
];


export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [screenContext, setScreenContext] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const toggleVoiceInput = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

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

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.warn("Error starting speech recognition:", err);
      setIsListening(false);
    }
  };

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

  // Liquid Glass Background hook from nebula-map
  const glassRef = useLiquidGlass<HTMLDivElement>(isOpen);

  // Draggable position & resizable size state
  const [hasMounted, setHasMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 520, height: 740 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ clientX: 0, clientY: 0, width: 520, height: 740 });

  const SAFE_MARGIN = 16;

  // Initialize position & size on client mount
  useEffect(() => {
    setHasMounted(true);
    if (typeof window !== "undefined") {
      let initialWidth = Math.min(520, window.innerWidth - 32);
      let initialHeight = Math.min(740, window.innerHeight - 60);
      const savedSize = localStorage.getItem("cyclonet_chat_size_v4");
      if (savedSize) {
        try {
          const parsed = JSON.parse(savedSize);
          if (typeof parsed.width === "number" && typeof parsed.height === "number") {
            initialWidth = Math.max(380, Math.min(parsed.width, window.innerWidth - 32));
            initialHeight = Math.max(400, Math.min(parsed.height, window.innerHeight - 60));
          }
        } catch (_) {}
      }
      setSize({ width: initialWidth, height: initialHeight });

      const savedPos = localStorage.getItem("cyclonet_chat_pos_v4");
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
      setPos({
        x: Math.max(SAFE_MARGIN, window.innerWidth - initialWidth - 24),
        y: Math.max(SAFE_MARGIN, window.innerHeight - initialHeight - 60)
      });
    }
  }, []);

  useEffect(() => {
    if (hasMounted && typeof window !== "undefined") {
      localStorage.setItem("cyclonet_chat_pos_v4", JSON.stringify(pos));
    }
  }, [pos, hasMounted]);

  useEffect(() => {
    if (hasMounted && typeof window !== "undefined") {
      localStorage.setItem("cyclonet_chat_size_v4", JSON.stringify(size));
    }
  }, [size, hasMounted]);

  // Listen for external open trigger
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
        const newH = Math.max(400, Math.min(resizeStart.height + deltaY, maxAllowedH));
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
        const newH = Math.max(400, Math.min(resizeStart.height + deltaY, maxAllowedH));
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen && !isMinimized && messages.length > 0) {
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
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
      
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
    setMessages([]);
    setIsMenuOpen(false);
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
              height: isMinimized ? "64px" : `${size.height}px`,
              zIndex: 9999,
              touchAction: (isDragging || isResizing) ? "none" : "auto",
              cursor: isDragging ? "grabbing" : isResizing ? "nwse-resize" : "default",
              userSelect: (isDragging || isResizing) ? "none" : "auto",
              boxShadow: (isDragging || isResizing)
                ? "0 30px 70px rgba(0,0,0,0.7), 0 0 30px rgba(59,130,246,0.2)" 
                : undefined
            }}
            className="liquid-glass-panel flex flex-col rounded-[26px] overflow-hidden transition-[box-shadow,height] duration-200 relative border border-white/15"
          >
            {/* Header: CycloNet AI • Gemini 3.6 • Meteorological Intelligence */}
            <div 
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
              className="chat-drag-handle p-3.5 px-5 bg-zinc-950/50 border-b border-white/10 flex items-center justify-between relative select-none shrink-0"
              title="Click and drag to move chat window"
            >
              <div className="flex items-center gap-3 pointer-events-none select-none">
                <div className="relative">
                  <CycloneLogo size={32} />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-white tracking-tight">CycloNet AI</h3>
                  <p className="text-[11px] text-zinc-400">
                    Meteorological Intelligence
                  </p>
                </div>
              </div>

              {/* Drag Grip Indicator */}
              <div className="hidden sm:flex items-center gap-0.5 text-zinc-500 hover:text-zinc-300 transition-colors pointer-events-none">
                <GripHorizontal className="w-4 h-4 opacity-60" />
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5 relative">
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen(!isMenuOpen);
                    }}
                    title="More Options"
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-44 bg-zinc-950/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden py-1 z-50 text-xs">
                      <button
                        onClick={handleClear}
                        className="w-full text-left px-3.5 py-2 text-zinc-300 hover:bg-white/10 flex items-center gap-2 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>New Conversation</span>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}
                  title={isMinimized ? "Maximize" : "Minimize"}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  title="Close Assistant"
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body Content (Hidden when minimized) */}
            {!isMinimized && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden relative">
                
                {/* Scrollable Container (Hero OR Messages) */}
                <div className="flex-1 p-5 overflow-y-auto space-y-4 scrollbar-thin bg-transparent">
                  
                  {/* Hero Initial Screen when no messages */}
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-2 animate-in fade-in duration-300">
                      
                      {/* Big Glowing Cyclone Emblem */}
                      <div className="relative my-3 flex items-center justify-center">
                        <div className="absolute w-28 h-28 rounded-full bg-blue-500/25 blur-2xl pointer-events-none" />
                        <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center relative shadow-lg shadow-blue-500/10">
                          <CycloneLogo size={54} />
                        </div>
                      </div>

                      {/* Main Greeting */}
                      <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white mt-2 tracking-tight">
                        Hi, I&apos;m <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-400 bg-clip-text text-transparent">CycloNet AI</span>
                      </h2>
                      <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-sm">
                        Your meteorological intelligence companion.
                      </p>

                      {/* Powered by divider */}
                      <div className="flex items-center gap-3 my-4 w-full max-w-xs">
                        <div className="h-px bg-white/10 flex-1" />
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-mono">
                          Powered by Google Gemini 3.6 Flash
                        </span>
                        <div className="h-px bg-white/10 flex-1" />
                      </div>

                      {/* 4 Feature Cards (2x2 Grid) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md my-1 text-left">
                        {FEATURE_CARDS.map((card, idx) => {
                          const Icon = card.icon;
                          return (
                            <button
                              key={idx}
                              onClick={() => handleSend(card.query)}
                              className="p-3.5 rounded-2xl bg-zinc-950/40 hover:bg-zinc-900/60 border border-white/10 hover:border-white/20 transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-sm hover:scale-[1.01]"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${card.iconBg} group-hover:scale-105 transition-transform`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-heading font-bold text-xs text-white group-hover:text-blue-300 transition-colors truncate">
                                    {card.title}
                                  </h4>
                                  <p className="text-[10.5px] text-zinc-400 leading-tight truncate">
                                    {card.desc}
                                  </p>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-white transition-colors shrink-0" />
                            </button>
                          );
                        })}
                      </div>

                    </div>
                  ) : (
                    /* Active Chat Stream */
                    <div className="space-y-4">
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
                                  className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
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
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" />
                            <span className="text-[11px] text-zinc-300 font-mono ml-2">
                              Analyzing meteorological telemetry...
                            </span>
                          </div>
                        </motion.div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>
                  )}

                </div>

                {/* Bottom Input Section */}
                <div className="p-4 border-t border-white/10 bg-zinc-950/50 backdrop-blur-md">
                  
                  {/* Sleek Input Bar */}
                  <div className="flex items-center gap-2.5 rounded-full bg-zinc-900/80 border border-white/15 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20 px-4 py-2.5 shadow-inner transition-all">
                    <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
                    
                    <input
                      ref={inputRef}
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Ask me anything about cyclones..."
                      className="flex-1 bg-transparent border-none outline-none text-xs text-white placeholder:text-zinc-400 leading-normal"
                    />

                    {/* Voice Input Mic Button */}
                    <button
                      type="button"
                      onClick={toggleVoiceInput}
                      title={isListening ? "Listening... Click to stop" : "Voice Input (Speak to CycloNet AI)"}
                      className={`p-1.5 rounded-full transition-all cursor-pointer ${
                        isListening
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse scale-110"
                          : "text-zinc-400 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      {isListening ? (
                        <MicOff className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Mic className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || loading}
                      className="w-8 h-8 rounded-full bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-30 disabled:pointer-events-none transition-all shadow-md shadow-blue-500/25 flex items-center justify-center shrink-0 cursor-pointer hover:scale-105"
                      title="Send Message"
                    >
                      <Send className="w-3.5 h-3.5 fill-current" />
                    </button>
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

              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

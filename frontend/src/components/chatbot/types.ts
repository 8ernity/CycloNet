import type { LucideIcon } from "lucide-react";
import { Cloud, Satellite, ShieldCheck, Sparkles } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  category?: string;
  sources?: string[];
  timestamp: string;
}

export interface ChatFeatureCard {
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
  iconBg: string;
  query: string;
}

export const CHAT_FEATURE_CARDS: ChatFeatureCard[] = [
  {
    title: "Current source status",
    desc: "Check availability and uncertainty",
    icon: Sparkles,
    color: "blue",
    iconBg: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    query: "What is the current backend source status?",
  },
  {
    title: "Hydrodynamic Storm Surge",
    desc: "Parametric physics & compound flooding",
    icon: Cloud,
    color: "cyan",
    iconBg: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    query:
      "Explain the hydrodynamic physics of storm surge in the Bay of Bengal: how the inverted barometer effect, shallow shelf bathymetry, and astronomical high tide combine to cause coastal inundation.",
  },
  {
    title: "Dvorak concepts",
    desc: "Learn the limits of image interpretation",
    icon: Satellite,
    color: "rose",
    iconBg: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    query:
      "Explain the Dvorak technique and why image classification is not a calibrated wind measurement.",
  },
  {
    title: "Cyclone formation",
    desc: "Explore general meteorology",
    icon: ShieldCheck,
    color: "emerald",
    iconBg: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    query: "Explain cyclogenesis.",
  },
];

"use client";

import React from "react";

export function renderFormattedInline(str: string, isUser: boolean = false) {
  const parts = str.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, pIdx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={pIdx} className={isUser ? "font-bold text-zinc-950" : "font-semibold text-white"}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.map((sub, sIdx) => {
      if (sub.startsWith("`") && sub.endsWith("`")) {
        return (
          <code
            key={sIdx}
            className={`px-1 py-0.5 rounded font-mono text-[11px] ${
              isUser ? "bg-zinc-200 text-zinc-950 font-bold" : "bg-white/10 text-zinc-100"
            }`}
          >
            {sub.slice(1, -1)}
          </code>
        );
      }
      return sub;
    });
  });
}

export function formatChatContent(text: string, isUser: boolean = false) {
  return text.split("\n").map((line, idx) => {
    if (line.startsWith("### ")) {
      return (
        <h4
          key={idx}
          className={`font-heading font-bold text-sm mt-3 mb-1.5 flex items-center gap-1.5 ${
            isUser ? "text-zinc-950 font-black" : "text-white"
          }`}
        >
          {line.replace("### ", "")}
        </h4>
      );
    }
    if (line.startsWith("#### ")) {
      return (
        <h5
          key={idx}
          className={`font-semibold text-xs mt-2 mb-1 ${
            isUser ? "text-zinc-900 font-bold" : "text-zinc-200"
          }`}
        >
          {line.replace("#### ", "")}
        </h5>
      );
    }
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const bulletText = line.trim().substring(2);
      return (
        <div
          key={idx}
          className={`flex items-start gap-2 ml-1 my-1 text-xs leading-relaxed ${
            isUser ? "text-zinc-950 font-medium" : "text-zinc-300"
          }`}
        >
          <span className={isUser ? "text-zinc-900 mt-1 text-[8px]" : "text-zinc-400 mt-1 text-[8px]"}>
            •
          </span>
          <span>{renderFormattedInline(bulletText, isUser)}</span>
        </div>
      );
    }
    if (/^\d+\.\s/.test(line.trim())) {
      const match = line.trim().match(/^(\d+\.)\s(.*)$/);
      if (match) {
        return (
          <div
            key={idx}
            className={`flex items-start gap-2 ml-1 my-1 text-xs leading-relaxed ${
              isUser ? "text-zinc-950 font-medium" : "text-zinc-300"
            }`}
          >
            <span className={`font-mono text-xs ${isUser ? "text-zinc-900 font-bold" : "text-zinc-400"}`}>
              {match[1]}
            </span>
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
        <div
          key={idx}
          className={`grid grid-cols-4 gap-1 py-1 px-1.5 text-[11px] border-b border-border/40 font-mono ${
            isUser ? "text-zinc-950" : ""
          }`}
        >
          {cells.map((cell, cIdx) => (
            <span
              key={cIdx}
              className={
                cIdx === 0
                  ? isUser
                    ? "font-bold text-zinc-950"
                    : "font-semibold text-white"
                  : isUser
                    ? "text-zinc-800 truncate"
                    : "text-zinc-400 truncate"
              }
            >
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
}

"use client";

import {useCallback, useEffect, useRef, useState} from "react";

/** Report only confirmed writes; stale completions cannot replace newer feedback. */
export function useClipboard() {
  const [copyStatus, setCopyStatus] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetCopy = useCallback(() => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    setCopyStatus(""); setCopiedId(null);
  }, []);
  useEffect(() => () => {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copyText = useCallback(async (text: string, id = "copy") => {
    const request = ++generation.current;
    if (timer.current) clearTimeout(timer.current);
    setCopiedId(null); setCopyStatus("Copying…");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      if (generation.current !== request) return;
      setCopiedId(id); setCopyStatus("Copied to clipboard.");
      timer.current = setTimeout(() => {
        if (generation.current === request) { setCopiedId(null); setCopyStatus(""); }
      }, 3000);
    } catch {
      if (generation.current === request) setCopyStatus("Copy failed. Select the text and copy it manually.");
    }
  }, []);
  return {copyText, copyStatus, copiedId, resetCopy};
}

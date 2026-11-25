"use client";

import { useState, useEffect, useCallback } from "react";

const SAFE_MARGIN = 16;
const MIN_WIDTH = 380;
const MIN_HEIGHT = 400;
const POS_STORAGE_KEY = "cyclonet_chat_pos_v4";
const SIZE_STORAGE_KEY = "cyclonet_chat_size_v4";

function fitDimension(value: number, minimum: number, available: number) {
  return Math.min(Math.max(1, available), Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

export function useChatWindowLayout(isMinimized: boolean) {
  const [hasMounted, setHasMounted] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 520, height: 740 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ clientX: 0, clientY: 0, width: 520, height: 740 });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setHasMounted(true);
      if (typeof window === "undefined") return;

      let initialWidth = Math.min(520, window.innerWidth - 32);
      let initialHeight = Math.min(740, window.innerHeight - 60);
      const savedSize = localStorage.getItem(SIZE_STORAGE_KEY);
      if (savedSize) {
        try {
          const parsed = JSON.parse(savedSize);
          if (typeof parsed.width === "number" && typeof parsed.height === "number") {
            initialWidth = fitDimension(parsed.width, MIN_WIDTH, window.innerWidth - 32);
            initialHeight = fitDimension(parsed.height, MIN_HEIGHT, window.innerHeight - 60);
          }
        } catch {
          // ignore corrupted storage entry
        }
      }
      setSize({ width: initialWidth, height: initialHeight });

      const savedPos = localStorage.getItem(POS_STORAGE_KEY);
      if (savedPos) {
        try {
          const parsed = JSON.parse(savedPos);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            const maxX = Math.max(SAFE_MARGIN, window.innerWidth - initialWidth - SAFE_MARGIN);
            const maxY = Math.max(SAFE_MARGIN, window.innerHeight - initialHeight - SAFE_MARGIN);
            setPos({
              x: Math.max(SAFE_MARGIN, Math.min(parsed.x, maxX)),
              y: Math.max(SAFE_MARGIN, Math.min(parsed.y, maxY)),
            });
            return;
          }
        } catch {
          // ignore corrupted storage entry
        }
      }
      setPos({
        x: Math.max(SAFE_MARGIN, window.innerWidth - initialWidth - 24),
        y: Math.max(SAFE_MARGIN, window.innerHeight - initialHeight - 60),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (hasMounted && typeof window !== "undefined") {
      localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
    }
  }, [pos, hasMounted]);

  useEffect(() => {
    if (hasMounted && typeof window !== "undefined") {
      localStorage.setItem(SIZE_STORAGE_KEY, JSON.stringify(size));
    }
  }, [size, hasMounted]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      const width = fitDimension(size.width, MIN_WIDTH, window.innerWidth - SAFE_MARGIN * 2);
      const height = fitDimension(size.height, MIN_HEIGHT, window.innerHeight - SAFE_MARGIN * 2);
      setSize({ width, height });
      const currentHeight = isMinimized ? 64 : height;
      const maxX = Math.max(SAFE_MARGIN, window.innerWidth - width - SAFE_MARGIN);
      const maxY = Math.max(SAFE_MARGIN, window.innerHeight - currentHeight - SAFE_MARGIN);
      setPos((prev) => ({
        x: Math.max(SAFE_MARGIN, Math.min(prev.x, maxX)),
        y: Math.max(SAFE_MARGIN, Math.min(prev.y, maxY)),
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [size.width, size.height, isMinimized]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if ("button" in e && e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, textarea, input, a, [role='button']")) return;

      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      setIsDragging(true);
      setDragOffset({ x: clientX - pos.x, y: clientY - pos.y });
    },
    [pos.x, pos.y]
  );

  const handleResizeStart = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

      setIsResizing(true);
      setResizeStart({
        clientX,
        clientY,
        width: size.width,
        height: size.height,
      });
    },
    [size.width, size.height]
  );

  const resizeBy = useCallback(
    (deltaWidth: number, deltaHeight: number) => {
      if (typeof window === "undefined") return;
      const maxAllowedW = window.innerWidth - pos.x - SAFE_MARGIN;
      const maxAllowedH = window.innerHeight - pos.y - SAFE_MARGIN;
      setSize((prev) => ({
        width: fitDimension(prev.width + deltaWidth, MIN_WIDTH, maxAllowedW),
        height: fitDimension(prev.height + deltaHeight, MIN_HEIGHT, maxAllowedH),
      }));
    },
    [pos.x, pos.y]
  );

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const applyPointerMove = (clientX: number, clientY: number) => {
      if (isDragging) {
        const currentHeight = isMinimized ? 56 : size.height;
        const maxX = Math.max(SAFE_MARGIN, window.innerWidth - size.width - SAFE_MARGIN);
        const maxY = Math.max(SAFE_MARGIN, window.innerHeight - currentHeight - SAFE_MARGIN);
        setPos({
          x: Math.max(SAFE_MARGIN, Math.min(clientX - dragOffset.x, maxX)),
          y: Math.max(SAFE_MARGIN, Math.min(clientY - dragOffset.y, maxY)),
        });
      } else if (isResizing) {
        const maxAllowedW = window.innerWidth - pos.x - SAFE_MARGIN;
        const maxAllowedH = window.innerHeight - pos.y - SAFE_MARGIN;
        setSize({
          width: fitDimension(resizeStart.width + (clientX - resizeStart.clientX), MIN_WIDTH, maxAllowedW),
          height: fitDimension(resizeStart.height + (clientY - resizeStart.clientY), MIN_HEIGHT, maxAllowedH),
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => applyPointerMove(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      applyPointerMove(e.touches[0].clientX, e.touches[0].clientY);
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

  return {
    hasMounted,
    pos,
    size,
    isDragging,
    isResizing,
    handleDragStart,
    handleResizeStart,
    resizeBy,
  };
}

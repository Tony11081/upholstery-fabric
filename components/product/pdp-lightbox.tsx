"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from "lucide-react";

type LightboxProps = {
  open: boolean;
  images: { url: string; alt: string }[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
};

type Pointer = { id: number; x: number; y: number };

export function PdpLightbox({ open, images, index, onClose, onNavigate }: LightboxProps) {
  const [scale, setScale] = useState(1);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, Pointer>>(new Map());
  const hasPointersRef = useRef(false);
  const baseDistanceRef = useRef<number | null>(null);
  const baseScaleRef = useRef(1);
  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);

  const current = useMemo(() => images[index], [images, index]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNavigate((index + 1) % images.length);
      if (e.key === "ArrowLeft") onNavigate((index - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, images.length, onClose, onNavigate]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setOrigin({ x: 0, y: 0 });
    baseScaleRef.current = 1;
    hasPointersRef.current = false;
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (bounds) {
      setOrigin({ x: (e.clientX - bounds.left) / bounds.width, y: (e.clientY - bounds.top) / bounds.height });
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      baseDistanceRef.current = distance(a, b);
      baseScaleRef.current = scale;
    }
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });
    hasPointersRef.current = pointersRef.current.size > 0;
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      if (baseDistanceRef.current) {
        const factor = distance(a, b) / baseDistanceRef.current;
        setScale(clamp(baseScaleRef.current * factor, 1, 3));
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    hasPointersRef.current = pointersRef.current.size > 0;
    if (pointersRef.current.size < 2) {
      baseDistanceRef.current = null;
      baseScaleRef.current = scale;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = clamp(scale - e.deltaY * 0.002, 1, 3);
    setScale(next);
    baseScaleRef.current = next;
  };

  const handleSwipe = (e: React.PointerEvent) => {
    if (pointersRef.current.size > 1) return;
    if (startXRef.current === null || startYRef.current === null) return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (Math.abs(dx) > 40 && Math.abs(dy) < 60) {
      if (dx < 0) onNavigate((index + 1) % images.length);
      else onNavigate((index - 1 + images.length) % images.length);
      startXRef.current = null;
      startYRef.current = null;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
      <button
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
        onClick={() => {
          resetZoom();
          onClose();
        }}
        aria-label="Close"
      >
        <X />
      </button>

      <div className="absolute left-4 top-4 z-10 flex items-center gap-3 text-sm text-white/80">
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
          onClick={() => {
            resetZoom();
            onNavigate((index - 1 + images.length) % images.length);
          }}
          aria-label="Previous image"
        >
          <ChevronLeft />
        </button>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 transition hover:bg-white/25"
          onClick={() => {
            resetZoom();
            onNavigate((index + 1) % images.length);
          }}
          aria-label="Next image"
        >
          <ChevronRight />
        </button>
        <span className="text-xs uppercase tracking-[0.2em]">{index + 1} / {images.length}</span>
      </div>

      <div
        ref={containerRef}
        className="flex h-full items-center justify-center px-6"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={(e) => {
          handlePointerMove(e);
          handleSwipe(e);
        }}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: "none" }}
      >
        <div
          className="relative h-[70vh] w-full max-w-4xl overflow-hidden rounded-2xl bg-black"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: `${origin.x * 100}% ${origin.y * 100}%`,
            transition: "transform 120ms ease-out",
          }}
          onDoubleClick={() => setScale(scale > 1 ? 1 : 2)}
        >
          <Image
            src={current.url}
            alt={current.alt}
            fill
            sizes="100vw"
            className="object-contain"
            priority
          />
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/10 px-4 py-2 text-white shadow-lg backdrop-blur">
        <button
          className="flex items-center gap-1 rounded-full px-3 py-1 text-sm transition hover:bg-white/10"
          onClick={() => setScale((s) => clamp(s + 0.25, 1, 3))}
        >
          <ZoomIn size={16} /> Zoom in
        </button>
        <button
          className="flex items-center gap-1 rounded-full px-3 py-1 text-sm transition hover:bg-white/10"
          onClick={() => setScale((s) => clamp(s - 0.25, 1, 3))}
        >
          <ZoomOut size={16} /> Zoom out
        </button>
        <button className="text-sm underline underline-offset-4" onClick={resetZoom}>
          Reset
        </button>
      </div>
    </div>
  );
}

function distance(a: Pointer, b: Pointer) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

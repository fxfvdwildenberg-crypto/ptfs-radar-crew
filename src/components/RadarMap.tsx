import { useEffect, useRef, useCallback } from "react";
import type { Aircraft } from "@/lib/ptfs.functions";

type Props = {
  aircraft: Aircraft[];
  selected: string | null;
  onSelect: (callsign: string | null) => void;
};

const MIN_ZOOM = 0.004;
const MAX_ZOOM = 0.6;

function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}

export function RadarMap({ aircraft, selected, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ zoom: 0.012, x: 0, y: 0, ready: false });
  const dataRef = useRef(aircraft);
  const selectedRef = useRef(selected);
  dataRef.current = aircraft;
  selectedRef.current = selected;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const v = view.current;
    if (!v.ready && dataRef.current.length) {
      v.x = w / 2;
      v.y = h / 2;
      v.ready = true;
    }

    const toScreen = (wx: number, wy: number) => ({
      sx: v.x + wx * v.zoom,
      sy: v.y - wy * v.zoom,
    });

    // grid
    const step = 5000;
    ctx.lineWidth = 1;
    ctx.strokeStyle = getComputedStyle(canvas).getPropertyValue("--radar-grid") || "#2a3b4a";
    ctx.beginPath();
    const startX = Math.floor((-v.x / v.zoom) / step) * step;
    const endX = startX + (w / v.zoom) + step;
    for (let gx = startX; gx <= endX; gx += step) {
      const { sx } = toScreen(gx, 0);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    const topY = (v.y) / v.zoom;
    const startY = Math.ceil(topY / step) * step;
    const endY = startY - (h / v.zoom) - step;
    for (let gy = startY; gy >= endY; gy -= step) {
      const { sy } = toScreen(0, gy);
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();

    const styles = getComputedStyle(document.documentElement);
    const cAir = styles.getPropertyValue("--radar-target").trim() || "#4ade80";
    const cGround = styles.getPropertyValue("--radar-ground").trim() || "#94a3b8";
    const cEmg = styles.getPropertyValue("--radar-emergency").trim() || "#ef4444";
    const cSel = styles.getPropertyValue("--accent").trim() || "#fbbf24";

    for (const a of dataRef.current) {
      const { sx, sy } = toScreen(a.x, a.y);
      if (sx < -60 || sy < -60 || sx > w + 60 || sy > h + 60) continue;
      const isSel = selectedRef.current === a.callsign;
      const color = a.isEmergencyOccuring ? cEmg : isSel ? cSel : a.isOnGround ? cGround : cAir;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate((a.heading * Math.PI) / 180);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-5, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (isSel) {
        ctx.strokeStyle = cSel;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (v.zoom > 0.03 || isSel) {
        ctx.fillStyle = color;
        ctx.font = "11px ui-monospace, monospace";
        ctx.fillText(a.callsign, sx + 10, sy - 4);
        ctx.fillStyle = cGround;
        ctx.fillText(
          `${String(Math.round(a.altitude / 100)).padStart(3, "0")} ${a.groundSpeed}kt`,
          sx + 10,
          sy + 8,
        );
      }
    }
  }, []);

  useEffect(() => {
    draw();
  }, [aircraft, selected, draw]);

  useEffect(() => {
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [draw]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const v = view.current;
      const next = clamp(v.zoom * Math.exp(-dy * 0.0015), MIN_ZOOM, MAX_ZOOM);
      const k = next / v.zoom;
      v.x = px - (px - v.x) * k;
      v.y = py - (py - v.y) * k;
      v.zoom = next;
      draw();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [draw]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let dragging = false;
    let moved = 0;
    let lx = 0;
    let ly = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      moved = 0;
      lx = e.clientX;
      ly = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      moved += Math.abs(dx) + Math.abs(dy);
      lx = e.clientX;
      ly = e.clientY;
      view.current.x += dx;
      view.current.y += dy;
      draw();
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (moved < 5) {
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const v = view.current;
        let best: { c: string; d: number } | null = null;
        for (const a of dataRef.current) {
          const sx = v.x + a.x * v.zoom;
          const sy = v.y - a.y * v.zoom;
          const d = Math.hypot(sx - px, sy - py);
          if (d < 18 && (!best || d < best.d)) best = { c: a.callsign, d };
        }
        onSelect(best ? best.c : null);
      }
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
  }, [draw, onSelect]);

  const zoomBy = (factor: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const v = view.current;
    const px = el.clientWidth / 2;
    const py = el.clientHeight / 2;
    const next = clamp(v.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const k = next / v.zoom;
    v.x = px - (px - v.x) * k;
    v.y = py - (py - v.y) * k;
    v.zoom = next;
    draw();
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full touch-none overflow-hidden bg-background"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute bottom-4 right-4 flex flex-col gap-2">
        <button
          onClick={() => zoomBy(1.5)}
          className="h-9 w-9 rounded-md border border-border bg-card text-lg text-foreground hover:bg-secondary"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => zoomBy(1 / 1.5)}
          className="h-9 w-9 rounded-md border border-border bg-card text-lg text-foreground hover:bg-secondary"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>
    </div>
  );
}

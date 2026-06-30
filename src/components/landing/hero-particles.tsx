"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  alpha: number;
};

const PARTICLE_COUNT = 500;
const DRIFT_SPEED = 0.12; // ambient px/frame
const LINK_DISTANCE = 84; // connect particles within this distance
const LINK_DISTANCE_SQ = LINK_DISTANCE * LINK_DISTANCE;
const POINTER_RADIUS = 170; // cursor pushes particles within this radius
const POINTER_RADIUS_SQ = POINTER_RADIUS * POINTER_RADIUS;
const POINTER_LINK = 130; // cursor draws links to particles within this
const POINTER_LINK_SQ = POINTER_LINK * POINTER_LINK;
const IDLE_MS = 120;
const GRID = 60; // spatial-hash cell size (≈ LINK_DISTANCE) for cheap neighbors

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createParticles(width: number, height: number): Particle[] {
  const rand = mulberry32(0x4e017e);
  return Array.from({ length: PARTICLE_COUNT }, () => {
    const angle = rand() * Math.PI * 2;
    const speed = DRIFT_SPEED * (0.4 + rand() * 0.8);
    return {
      x: rand() * width,
      y: rand() * height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 0.6 + rand() * 1.3,
      alpha: 0.25 + rand() * 0.4,
    };
  });
}

export function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let frameId = 0;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let inkRGB = "23,23,23";
    const pointer = { active: false, x: 0, y: 0, lastMoveAt: 0 };
    // Spatial hash so neighbour links stay O(n), not O(n²), at 500 particles.
    const buckets = new Map<number, Particle[]>();

    const syncInk = () => {
      inkRGB = document.documentElement.classList.contains("dark")
        ? "236,236,236"
        : "23,23,23";
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particles = createParticles(width, height);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (isMobile || prefersReducedMotion) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || x > rect.width || y < 0 || y > rect.height) {
        pointer.active = false;
        return;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
      pointer.lastMoveAt = performance.now();
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    const render = (time: number) => {
      context.clearRect(0, 0, width, height);
      if (width <= 0 || height <= 0) {
        frameId = window.requestAnimationFrame(render);
        return;
      }

      const pointerIsHot =
        pointer.active && time - pointer.lastMoveAt < IDLE_MS;

      // 1) Integrate motion + rebuild the spatial hash.
      buckets.clear();
      const cols = Math.max(1, Math.ceil(width / GRID));
      for (const p of particles) {
        if (!isMobile && !prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          // Wrap around the edges for a seamless field.
          if (p.x < -2) p.x = width + 2;
          else if (p.x > width + 2) p.x = -2;
          if (p.y < -2) p.y = height + 2;
          else if (p.y > height + 2) p.y = -2;

          // Cursor gently pushes nearby particles outward.
          if (pointerIsHot) {
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < POINTER_RADIUS_SQ && d2 > 0.01) {
              const d = Math.sqrt(d2);
              const push = (1 - d / POINTER_RADIUS) * 0.6;
              p.x += (dx / d) * push;
              p.y += (dy / d) * push;
            }
          }
        }
        const key = Math.floor(p.x / GRID) + Math.floor(p.y / GRID) * cols;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(p);
        else buckets.set(key, [p]);
      }

      // 2) Neighbour links (faint hairlines between close particles).
      context.lineWidth = 1;
      for (const p of particles) {
        const cx = Math.floor(p.x / GRID);
        const cy = Math.floor(p.y / GRID);
        for (let gx = cx; gx <= cx + 1; gx++) {
          for (let gy = cy - 1; gy <= cy + 1; gy++) {
            if (gx === cx && gy < cy) continue; // avoid double-counting pairs
            const bucket = buckets.get(gx + gy * cols);
            if (!bucket) continue;
            for (const q of bucket) {
              if (q === p) continue;
              if (gx === cx && gy === cy && q.x < p.x) continue;
              const dx = p.x - q.x;
              const dy = p.y - q.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < LINK_DISTANCE_SQ) {
                const a = (1 - d2 / LINK_DISTANCE_SQ) * 0.16;
                context.strokeStyle = `rgba(${inkRGB},${a})`;
                context.beginPath();
                context.moveTo(p.x, p.y);
                context.lineTo(q.x, q.y);
                context.stroke();
              }
            }
          }
        }
      }

      // 3) Cursor links — the field "reaches" toward the pointer.
      if (pointerIsHot) {
        for (const p of particles) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < POINTER_LINK_SQ) {
            const a = (1 - d2 / POINTER_LINK_SQ) * 0.34;
            context.strokeStyle = `rgba(${inkRGB},${a})`;
            context.beginPath();
            context.moveTo(p.x, p.y);
            context.lineTo(pointer.x, pointer.y);
            context.stroke();
          }
        }
      }

      // 4) Dots on top.
      for (const p of particles) {
        context.globalAlpha = p.alpha;
        context.fillStyle = `rgb(${inkRGB})`;
        context.beginPath();
        context.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalAlpha = 1;

      frameId = window.requestAnimationFrame(render);
    };

    syncInk();
    resize();

    const themeObserver = new MutationObserver(syncInk);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerleave", handlePointerLeave);

    frameId = window.requestAnimationFrame(render);

    return () => {
      themeObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.cancelAnimationFrame(frameId);
    };
  }, [isMobile, prefersReducedMotion]);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] overflow-hidden [mask-image:radial-gradient(120%_80%_at_50%_28%,black,transparent_78%)]"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}

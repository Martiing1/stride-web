"use client";

import { useEffect, useState } from "react";
import { Loader2, Mountain, Route as RouteIcon } from "lucide-react";

interface Point {
  lat: number;
  lon: number;
  ele: number | null;
}

interface Parsed {
  points: Point[];
  distanceKm: number;
  elevationGain: number | null;
}

function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function parseGpx(xml: string): Parsed | null {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) return null;
  // trkpt (rutas grabadas) o rtept (rutas planificadas)
  const nodes = Array.from(doc.querySelectorAll("trkpt, rtept"));
  const points: Point[] = nodes
    .map((node) => ({
      lat: Number(node.getAttribute("lat")),
      lon: Number(node.getAttribute("lon")),
      ele: node.querySelector("ele") ? Number(node.querySelector("ele")!.textContent) : null,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (points.length < 2) return null;

  let distance = 0;
  let gain = 0;
  let hasEle = false;
  for (let i = 1; i < points.length; i++) {
    distance += haversineKm(points[i - 1], points[i]);
    const prev = points[i - 1].ele;
    const curr = points[i].ele;
    if (prev != null && curr != null) {
      hasEle = true;
      if (curr > prev) gain += curr - prev;
    }
  }
  return { points, distanceKm: distance, elevationGain: hasEle ? Math.round(gain) : null };
}

/**
 * Trazado del GPX como SVG, sin mapa de fondo ni dependencias: proyección
 * equirectangular corregida por latitud. Suficiente para reconocer la forma
 * de la ruta y validar que el archivo es el correcto.
 */
export function GpxPreview({ url }: { url: string }) {
  const [state, setState] = useState<{ status: "loading" | "error" } | { status: "ok"; data: Parsed }>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) throw new Error();
        const parsed = parseGpx(await response.text());
        if (!parsed) throw new Error();
        if (!cancelled) setState({ status: "ok", data: parsed });
      } catch {
        if (!cancelled) setState({ status: "error" });
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  if (state.status !== "ok") {
    return state.status === "loading" ? (
      <p className="mt-3 flex items-center gap-2 text-xs text-white/35"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Leyendo GPX…</p>
    ) : (
      <p className="mt-3 text-xs text-white/35">No se pudo previsualizar el GPX (el archivo igual queda descargable).</p>
    );
  }

  const { points, distanceKm, elevationGain } = state.data;
  const midLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = points.map((p) => p.lon * kx);
  const ys = points.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const W = 320, H = 180, PAD = 12;
  const scale = (Math.min(W, H) - PAD * 2) / span;
  const ox = (W - (maxX - minX) * scale) / 2;
  const oy = (H - (maxY - minY) * scale) / 2;
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${((p.lon * kx - minX) * scale + ox).toFixed(1)},${((-p.lat - minY) * scale + oy).toFixed(1)}`)
    .join("");
  const start = points[0];
  const end = points[points.length - 1];
  const toXY = (p: Point) => [((p.lon * kx - minX) * scale + ox).toFixed(1), ((-p.lat - minY) * scale + oy).toFixed(1)];
  const [sx, sy] = toXY(start);
  const [ex, ey] = toXY(end);

  return (
    <div className="mt-3 rounded-xl border border-white/5 bg-black/25 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Trazado de la ruta">
        <path d={path} fill="none" stroke="#3987e5" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={sx} cy={sy} r={4} fill="#199e70" />
        <circle cx={ex} cy={ey} r={4} fill="#d95926" />
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/55">
        <span className="flex items-center gap-1.5"><RouteIcon className="h-3.5 w-3.5 text-white/35" /> {distanceKm.toFixed(1)} km</span>
        {elevationGain != null && (
          <span className="flex items-center gap-1.5"><Mountain className="h-3.5 w-3.5 text-white/35" /> +{elevationGain} m</span>
        )}
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#199e70" }} /> salida</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "#d95926" }} /> llegada</span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Pide la ubicación al navegador del comercio y la adjunta al escaneo que la
 * página ya registró en el servidor.
 *
 * No renderiza nada ni bloquea la validación: si el local rechaza el permiso,
 * solo se marca el escaneo como 'denegado' y el miembro igual pudo usar su
 * beneficio.
 */
export function ScanGeoReporter({ scanId }: { scanId: string }) {
  const reported = useRef(false);

  useEffect(() => {
    // React 18+ monta dos veces en desarrollo: evita el doble PATCH.
    if (reported.current) return;
    reported.current = true;

    const send = (body: Record<string, unknown>) => {
      void fetch(`/api/scans/${scanId}/geo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {
        // Sin conexión o petición abortada: el escaneo ya quedó registrado
        // sin ubicación, que es el comportamiento aceptable.
      });
    };

    if (!("geolocation" in navigator)) {
      send({ geo_source: "no_disponible" });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        send({
          geo_source: "gps",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
        });
      },
      (error) => {
        send({
          geo_source: error.code === error.PERMISSION_DENIED ? "denegado" : "no_disponible",
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  }, [scanId]);

  return null;
}

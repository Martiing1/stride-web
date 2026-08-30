import { ScanLine, MapPin, MapPinOff } from "lucide-react";
import { requireTeamMember } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { todayInChile } from "@/lib/membership";
import type { Benefit, Scan } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ScanWithMember extends Scan {
  members: { full_name: string } | null;
}

export default async function EscaneosPage() {
  await requireTeamMember(["socio", "lider_comunidad"]);
  // Cliente de servicio: desde la migración 003 solo el dueño lee `members`, y
  // con la sesión normal el join devolvía null y la lista salía sin nombres.
  // El permiso ya se verificó arriba.
  const supabase = createServiceClient();

  const monthStart = `${todayInChile().slice(0, 7)}-01`;

  const [{ data }, { data: benefitsData }] = await Promise.all([
    supabase
      .from("scans")
      .select("*, members(full_name)")
      .order("scanned_at", { ascending: false })
      .limit(200),
    supabase.from("benefits").select("id, business_name, lat, lng"),
  ]);

  const scans = (data ?? []) as ScanWithMember[];
  const located = ((benefitsData ?? []) as Benefit[]).filter((b) => b.lat != null && b.lng != null);

  // Local más cercano al escaneo, hasta 500 m: con eso se sabe dónde se cobra
  // cada beneficio, que es el dato para renegociar convenios.
  function nearestBenefit(lat: number, lng: number): Benefit | null {
    let best: Benefit | null = null;
    let bestKm = 0.5;
    for (const benefit of located) {
      const dLat = ((benefit.lat! - lat) * Math.PI) / 180;
      const dLng = ((benefit.lng! - lng) * Math.PI) / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((benefit.lat! * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      const km = 2 * 6371 * Math.asin(Math.sqrt(a));
      if (km < bestKm) { bestKm = km; best = benefit; }
    }
    return best;
  }

  const scanBenefit = new Map<string, string>();
  const perLocal = new Map<string, number>();
  for (const scan of scans) {
    if (scan.geo_source === "gps" && scan.lat != null && scan.lng != null) {
      const benefit = nearestBenefit(scan.lat, scan.lng);
      if (benefit) {
        scanBenefit.set(scan.id, benefit.business_name);
        perLocal.set(benefit.business_name, (perLocal.get(benefit.business_name) ?? 0) + 1);
      }
    }
  }
  const localesRanked = Array.from(perLocal.entries()).sort((a, b) => b[1] - a[1]);

  const thisMonth = scans.filter((s) => s.scanned_at >= monthStart);
  const withGeo = scans.filter((s) => s.geo_source === "gps").length;
  const uniqueMembers = new Set(thisMonth.map((s) => s.member_id).filter(Boolean)).size;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-3xl font-extrabold text-white">Escaneos</h1>
        <p className="mt-1 max-w-2xl text-white/50">
          Cada vez que un comercio valida el QR de un miembro queda registrado acá. Es el dato para
          negociar la renovación de los convenios.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Escaneos este mes", value: thisMonth.length },
          { label: "Miembros distintos", value: uniqueMembers },
          { label: "Con ubicación", value: `${withGeo}/${scans.length}` },
        ].map((s) => (
          <div key={s.label} className="card">
            <p className="text-sm text-white/50">{s.label}</p>
            <p className="mt-1 font-heading text-3xl font-extrabold text-white">{s.value}</p>
          </div>
        ))}
      </section>

      {localesRanked.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-heading text-lg font-bold text-white">Dónde se cobra</h2>
          <ul className="space-y-1.5">
            {localesRanked.map(([name, count]) => (
              <li key={name} className="flex items-center justify-between text-sm">
                <span className="text-white/70">{name}</span>
                <span className="font-semibold text-white">{count} escaneo{count === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-white/35">
            Se cruza la ubicación del escaneo con las coordenadas cargadas en Convenios (radio 500 m).
          </p>
        </section>
      )}

      {scans.length > 0 ? (
        <section className="space-y-2">
          {scans.map((scan) => (
            <div key={scan.id} className="card flex flex-wrap items-center gap-4 py-4">
              <div className="min-w-[180px] flex-1">
                <p className="text-sm text-white">
                  {scan.members?.full_name ?? (
                    <span className="text-white/40">Código desconocido</span>
                  )}
                </p>
                <p className="mt-0.5 font-mono text-xs text-white/35">{scan.member_code}</p>
              </div>

              <div className="text-xs text-white/45">
                {new Date(scan.scanned_at).toLocaleString("es-CL", {
                  timeZone: "America/Santiago",
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>

              {scanBenefit.get(scan.id) && (
                <span className="shrink-0 rounded-full bg-stride-cyan/10 px-2.5 py-1 text-xs font-semibold text-stride-cyan">
                  {scanBenefit.get(scan.id)}
                </span>
              )}
              {scan.geo_source === "gps" && scan.lat && scan.lng ? (
                <a
                  href={`https://www.google.com/maps?q=${scan.lat},${scan.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 text-xs text-stride-accent hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" /> Ver en mapa
                </a>
              ) : (
                <span className="flex shrink-0 items-center gap-1 text-xs text-white/30">
                  <MapPinOff className="h-3.5 w-3.5" />
                  {scan.geo_source === "denegado" ? "Sin permiso" : "Sin ubicación"}
                </span>
              )}

              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  scan.was_valid
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400"
                }`}
              >
                {scan.was_valid ? "Válida" : "Rechazada"}
              </span>
            </div>
          ))}
        </section>
      ) : (
        <div className="card flex flex-col items-center gap-3 py-14 text-center">
          <ScanLine className="h-10 w-10 text-white/25" />
          <p className="font-heading text-lg font-bold text-white">Todavía no hay escaneos</p>
          <p className="max-w-sm text-sm text-white/50">
            Aparecerán acá apenas un comercio valide la tarjeta de un miembro.
          </p>
        </div>
      )}
    </div>
  );
}

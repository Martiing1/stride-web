"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ExternalLink, History, Lock, Search } from "lucide-react";

export interface RuleRow {
  id: string;
  code: string;
  title: string;
  statement: string;
  level: number;
  area: string | null;
  source_ref: string | null;
  visibility: string;
  status: string;
  origin: string;
  origin_doc_url: string | null;
  origin_meeting_id: string | null;
  effective_from: string | null;
}

export interface ChangeRow {
  id: string;
  rule_id: string;
  change_kind: string;
  previous_statement: string | null;
  reason: string | null;
  applied_at: string;
  meetings: { title: string; meeting_date: string; drive_url: string | null } | null;
}

const LEVEL_LABEL: Record<number, string> = { 2: "Pacto", 3: "Reglamento", 4: "Acuerdo de reunión" };

function formatDate(value: string | null) {
  if (!value) return "sin fecha";
  const [y, m, d] = value.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** El reglamento vivo: buscador, filtro por área y el historial de cada regla. */
export function RulesBook({
  rules,
  changes,
  isSocio,
}: {
  rules: RuleRow[];
  changes: ChangeRow[];
  isSocio: boolean;
}) {
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string>("todas");
  const [open, setOpen] = useState<string | null>(null);

  const areas = useMemo(
    () => ["todas", ...Array.from(new Set(rules.map((r) => r.area ?? "Sin área"))).sort()],
    [rules]
  );

  const changesByRule = useMemo(() => {
    const map = new Map<string, ChangeRow[]>();
    for (const c of changes) map.set(c.rule_id, [...(map.get(c.rule_id) ?? []), c]);
    return map;
  }, [changes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rules.filter((r) => {
      if (area !== "todas" && (r.area ?? "Sin área") !== area) return false;
      if (!q) return true;
      return `${r.code} ${r.title} ${r.statement}`.toLowerCase().includes(q);
    });
  }, [rules, query, area]);

  const grouped = useMemo(() => {
    const map = new Map<string, RuleRow[]>();
    for (const r of filtered) {
      const key = r.area ?? "Sin área";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
          <Search className="h-4 w-4 flex-none text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar una regla…"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {areas.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setArea(a)}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
                area === a ? "bg-stride-accent text-white" : "border border-white/10 text-white/55 hover:bg-white/5"
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-white/35">
        {filtered.length} {filtered.length === 1 ? "regla" : "reglas"}
      </p>

      {grouped.map(([areaName, items]) => (
        <section key={areaName}>
          <h2 className="mb-2.5 font-heading text-sm font-bold uppercase tracking-wider text-white/45">{areaName}</h2>
          <div className="space-y-1.5">
            {items.map((rule) => {
              const history = changesByRule.get(rule.id) ?? [];
              const modificada = history.filter((h) => h.change_kind === "modificada");
              const isOpen = open === rule.id;
              return (
                <article
                  key={rule.id}
                  className={clsx(
                    "overflow-hidden rounded-xl border bg-white/[0.02] transition",
                    isOpen ? "border-stride-accent/40" : "border-white/8 hover:border-white/15"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : rule.id)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left"
                  >
                    <span className="mt-0.5 flex-none font-mono text-[11px] font-bold text-stride-accent">{rule.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-heading text-sm font-bold text-white">{rule.title}</span>
                        {rule.visibility === "socios" && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                            <Lock className="h-2.5 w-2.5" /> Socios
                          </span>
                        )}
                        {modificada.length > 0 && (
                          <span className="flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                            <History className="h-2.5 w-2.5" /> {modificada.length} cambio{modificada.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </span>
                      {!isOpen && (
                        <span className="mt-1 line-clamp-1 block text-xs text-white/40">{rule.statement}</span>
                      )}
                    </span>
                    <span className="flex-none text-[10px] font-semibold uppercase tracking-wider text-white/25">
                      Nivel {rule.level}
                    </span>
                    <ChevronDown className={clsx("h-4 w-4 flex-none text-white/25 transition", isOpen && "rotate-180")} />
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/8 px-4 py-4">
                      <p className="text-sm leading-relaxed text-white/75">{rule.statement}</p>

                      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[11px]">
                        <div>
                          <dt className="text-white/30">Rige desde</dt>
                          <dd className="font-semibold text-white/70">{formatDate(rule.effective_from)}</dd>
                        </div>
                        <div>
                          <dt className="text-white/30">Nivel</dt>
                          <dd className="font-semibold text-white/70">{LEVEL_LABEL[rule.level] ?? rule.level}</dd>
                        </div>
                        {rule.source_ref && (
                          <div>
                            <dt className="text-white/30">Referencia</dt>
                            <dd className="font-semibold text-white/70">{rule.source_ref}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="text-white/30">Origen</dt>
                          <dd className="font-semibold text-white/70">
                            {rule.origin === "reglamento" ? "Reglamento Operativo" : rule.origin === "acta" ? "Acuerdo de reunión" : rule.origin}
                          </dd>
                        </div>
                      </dl>

                      {history.length > 0 && (
                        <div className="mt-4 border-t border-white/8 pt-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/35">Historia</p>
                          <ol className="mt-2 space-y-2.5">
                            {history.map((h) => (
                              <li key={h.id} className="flex gap-2.5 text-xs">
                                <span
                                  className={clsx(
                                    "mt-1 h-1.5 w-1.5 flex-none rounded-full",
                                    h.change_kind === "creada" ? "bg-emerald-400" : "bg-sky-400"
                                  )}
                                />
                                <span className="min-w-0">
                                  <span className="font-semibold text-white/70">
                                    {h.change_kind === "creada" ? "Nace" : "Cambia"}
                                    {h.meetings ? ` · ${formatDate(h.meetings.meeting_date)}` : ""}
                                  </span>
                                  {h.reason && <span className="block text-white/45">{h.reason}</span>}
                                  {h.previous_statement && (
                                    <span className="mt-1 block rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-white/40 line-through">
                                      {h.previous_statement}
                                    </span>
                                  )}
                                  {h.meetings?.drive_url && (
                                    <a
                                      href={h.meetings.drive_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-stride-accent hover:underline"
                                    >
                                      Ver el acta <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {rule.origin_doc_url && (
                        <a
                          href={rule.origin_doc_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-stride-accent hover:underline"
                        >
                          Abrir el documento fuente <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-white/10 p-10 text-center text-sm text-white/40">
          No hay reglas que calcen con esa búsqueda.
        </div>
      )}

      {!isSocio && (
        <p className="text-xs leading-relaxed text-white/30">
          Algunas reglas están reservadas a los socios y no aparecen en esta lista.
        </p>
      )}
    </div>
  );
}

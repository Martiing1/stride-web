"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, Eye, EyeOff, LayoutDashboard, Loader2, ShieldCheck, Tags, Users, X } from "lucide-react";
import { saveBoardLabels, saveDashboardWidgets, saveRoleModules } from "@/app/admin/configuracion/actions";
import { DASHBOARD_WIDGETS, type ModuleDef, type WidgetId } from "@/lib/app-settings";
import { ROLE_LABELS } from "@/lib/roles";
import type { Role } from "@/lib/types";

type SaveState = { tone: "ok" | "error"; text: string } | null;

function SaveBar({ pending, message, onSave }: { pending: boolean; message: SaveState; onSave: () => void }) {
  return (
    <div className="flex items-center gap-3 border-t border-white/5 pt-4">
      <button type="button" onClick={onSave} disabled={pending} className="btn-primary">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" /> Guardar</>}
      </button>
      {message && (
        <span className={`text-sm ${message.tone === "ok" ? "text-emerald-300" : "text-red-300"}`}>{message.text}</span>
      )}
    </div>
  );
}

// ─── Permisos por rol ────────────────────────────────────────────────────────

const EDITABLE_ROLES: Array<Extract<Role, "lider_comunidad" | "monitor">> = ["lider_comunidad", "monitor"];

/**
 * "Qué ve este rol": vista previa del menú con interruptores. Solo puede
 * ocultar dentro de lo que el código ya permite; lo restringido a socios ni
 * aparece como opción.
 */
export function RolePermissionsEditor({
  modules,
  initialHidden,
}: {
  modules: ModuleDef[];
  initialHidden: Partial<Record<Role, string[]>>;
}) {
  const [role, setRole] = useState<(typeof EDITABLE_ROLES)[number]>("lider_comunidad");
  const [hidden, setHidden] = useState<Record<string, Set<string>>>({
    lider_comunidad: new Set(initialHidden.lider_comunidad ?? []),
    monitor: new Set(initialHidden.monitor ?? []),
  });
  const [previewRole, setPreviewRole] = useState<(typeof EDITABLE_ROLES)[number] | null>(null);
  const [message, setMessage] = useState<SaveState>(null);
  const [pending, startTransition] = useTransition();

  const visibleForRole = modules.filter((m) => !m.roles || m.roles.includes(role));
  const sections = Array.from(new Set(visibleForRole.map((m) => m.section)));

  function toggle(href: string) {
    setHidden((prev) => {
      const next = new Set(prev[role]);
      if (next.has(href)) next.delete(href);
      else next.add(href);
      return { ...prev, [role]: next };
    });
  }

  function save() {
    setMessage(null);
    const form = new FormData();
    form.set("payload", JSON.stringify({
      lider_comunidad: Array.from(hidden.lider_comunidad),
      monitor: Array.from(hidden.monitor),
    }));
    startTransition(async () => {
      const result = await saveRoleModules(form);
      setMessage(result.ok ? { tone: "ok", text: "Permisos guardados." } : { tone: "error", text: result.error ?? "Error" });
    });
  }

  return (
    <section className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
          <Eye className="h-5 w-5 text-stride-cyan" /> Qué ve cada rol
        </h2>
        <div className="flex gap-2">
          {EDITABLE_ROLES.map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${role === r ? "border-stride-accent bg-stride-accent/15 text-white" : "border-white/10 text-white/50 hover:text-white"}`}>
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {EDITABLE_ROLES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setPreviewRole(r)}
            className="inline-flex items-center gap-2 rounded-full border border-stride-cyan/35 px-4 py-2 text-sm font-semibold text-stride-cyan transition hover:border-stride-cyan hover:bg-stride-cyan/10"
          >
            <Eye className="h-4 w-4" /> Ver vista de {ROLE_LABELS[r]}
          </button>
        ))}
      </div>
      <p className="text-sm text-white/45">
        Así se ve el menú de un {ROLE_LABELS[role].toLowerCase()}. Apaga lo que no deba ver;
        lo que es solo de socios ni siquiera aparece acá.
      </p>

      <div className="max-w-sm space-y-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        {sections.map((section) => (
          <div key={section}>
            <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-widest text-white/30">{section}</p>
            <ul className="space-y-0.5">
              {visibleForRole.filter((m) => m.section === section).map((mod) => {
                const isHidden = hidden[role].has(mod.href);
                return (
                  <li key={mod.href}>
                    <button
                      type="button"
                      disabled={mod.fixed}
                      onClick={() => toggle(mod.href)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${isHidden ? "text-white/25 line-through" : "text-white/75"} ${mod.fixed ? "cursor-default" : "hover:bg-white/5"}`}
                    >
                      {mod.label}
                      {mod.fixed ? (
                        <span className="text-[10px] uppercase text-white/25">fijo</span>
                      ) : isHidden ? (
                        <EyeOff className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Eye className="h-3.5 w-3.5 shrink-0 text-stride-cyan" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <SaveBar pending={pending} message={message} onSave={save} />

      {previewRole && (
        <RolePreview
          role={previewRole}
          modules={modules}
          hidden={hidden[previewRole]}
          onClose={() => setPreviewRole(null)}
        />
      )}
    </section>
  );
}

/** Vista visual, no navegable, para revisar el ERP sin cambiar de cuenta. */
function RolePreview({
  role,
  modules,
  hidden,
  onClose,
}: {
  role: (typeof EDITABLE_ROLES)[number];
  modules: ModuleDef[];
  hidden: Set<string>;
  onClose: () => void;
}) {
  const visible = modules.filter(
    (module) => (!module.roles || module.roles.includes(role)) && (module.fixed || !hidden.has(module.href))
  );
  const sections = Array.from(new Set(visible.map((module) => module.section)));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:p-8" role="dialog" aria-modal="true" aria-label={`Vista de ${ROLE_LABELS[role]}`}>
      <div className="mx-auto min-h-[620px] max-w-6xl overflow-hidden rounded-2xl border border-white/15 bg-stride-bg shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-stride-cyan">Vista previa</p>
            <h3 className="font-heading text-lg font-bold text-white">Lo que ve un {ROLE_LABELS[role]}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-white/10 p-2 text-white/60 hover:text-white" aria-label="Cerrar vista previa">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-[550px]">
          <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black/20 p-4 sm:block">
            <p className="mb-6 font-heading text-xl font-extrabold text-white">STRIDE</p>
            <div className="space-y-5">
              {sections.map((section) => (
                <div key={section}>
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">{section}</p>
                  {visible.filter((module) => module.section === section).map((module) => (
                    <div key={module.href} className="rounded-lg px-2 py-1.5 text-sm text-white/65">{module.label}</div>
                  ))}
                </div>
              ))}
            </div>
          </aside>

          <main className="min-w-0 flex-1 p-6 sm:p-9">
            <p className="text-sm text-white/45">Sistema interno</p>
            <h4 className="mt-1 font-heading text-3xl font-extrabold text-white">Hola, {ROLE_LABELS[role]}</h4>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/50">
              Esta previsualización refleja los módulos visibles con la configuración actual. No cambia
              tu sesión ni da permisos adicionales.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visible.slice(0, 6).map((module) => (
                <div key={module.href} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-sm text-white/45">Módulo disponible</p>
                  <p className="mt-1 font-heading text-lg font-bold text-white">{module.label}</p>
                </div>
              ))}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ─── Widgets del dashboard ───────────────────────────────────────────────────

export function DashboardWidgetsEditor({ initial }: { initial: WidgetId[] }) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(initial));
  const [message, setMessage] = useState<SaveState>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    const ordered = DASHBOARD_WIDGETS.map((w) => w.id).filter((id) => enabled.has(id));
    const form = new FormData();
    form.set("payload", JSON.stringify(ordered));
    startTransition(async () => {
      const result = await saveDashboardWidgets(form);
      setMessage(result.ok ? { tone: "ok", text: "Dashboard actualizado." } : { tone: "error", text: result.error ?? "Error" });
    });
  }

  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
        <LayoutDashboard className="h-5 w-5 text-stride-cyan" /> Qué muestra el dashboard
      </h2>
      <ul className="space-y-2">
        {DASHBOARD_WIDGETS.map((widget) => (
          <li key={widget.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm text-white/70 hover:border-white/15">
              <input
                type="checkbox"
                checked={enabled.has(widget.id)}
                onChange={(e) => {
                  const next = new Set(enabled);
                  if (e.target.checked) next.add(widget.id);
                  else next.delete(widget.id);
                  setEnabled(next);
                }}
                className="h-4 w-4 accent-[#7C3AED]"
              />
              {widget.label}
            </label>
          </li>
        ))}
      </ul>
      <SaveBar pending={pending} message={message} onSave={save} />
    </section>
  );
}

// ─── Nombres de columnas de los tableros ─────────────────────────────────────

export function BoardLabelsEditor({
  kind,
  title,
  initial,
}: {
  kind: "lead_labels" | "task_labels";
  title: string;
  initial: Record<string, string>;
}) {
  const [labels, setLabels] = useState(initial);
  const [message, setMessage] = useState<SaveState>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    const form = new FormData();
    form.set("kind", kind);
    form.set("payload", JSON.stringify(labels));
    startTransition(async () => {
      const result = await saveBoardLabels(form);
      setMessage(result.ok ? { tone: "ok", text: "Nombres guardados." } : { tone: "error", text: result.error ?? "Error" });
    });
  }

  return (
    <section className="card space-y-4">
      <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-white">
        <Tags className="h-5 w-5 text-stride-cyan" /> {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {Object.entries(labels).map(([key, value]) => (
          <div key={key}>
            <label htmlFor={`${kind}-${key}`} className="label capitalize">{key.replace("_", " ")}</label>
            <input
              id={`${kind}-${key}`}
              value={value}
              onChange={(e) => setLabels({ ...labels, [key]: e.target.value })}
              className="input"
            />
          </div>
        ))}
      </div>
      <SaveBar pending={pending} message={message} onSave={save} />
    </section>
  );
}

// ─── Accesos rápidos ─────────────────────────────────────────────────────────

export function ConfigShortcuts() {
  const items = [
    { href: "/admin/equipo", icon: Users, title: "Equipo", text: "Crear, editar y dar acceso a las personas; roles y fotos." },
    { href: "/admin/seguridad", icon: ShieldCheck, title: "Seguridad", text: "Tu segundo factor y tu foto de perfil." },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map(({ href, icon: Icon, title, text }) => (
        <Link key={href} href={href} className="card transition hover:border-white/20">
          <Icon className="h-6 w-6 text-stride-cyan" />
          <p className="mt-3 font-heading font-bold text-white">{title}</p>
          <p className="mt-1 text-sm text-white/45">{text}</p>
        </Link>
      ))}
    </div>
  );
}

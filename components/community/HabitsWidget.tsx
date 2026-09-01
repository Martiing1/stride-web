"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { deleteHabit, saveHabit, toggleHabitToday } from "@/app/miembros/community-actions";
import type { HabitsToday } from "@/lib/community";

const COLORS = ["#00E5FF", "#6366F1", "#7C3AED", "#F59E0B", "#34D399", "#F472B6"];
const CONFETTI = ["#00E5FF", "#6366F1", "#7C3AED", "#F59E0B", "#ffffff", "#c4b5fd"];
const EMOJIS = [
  "💧", "🏃", "😴", "📖", "🧘", "💪", "🥗", "🍎", "🚰", "⏰", "🌅", "🚶",
  "🚴", "🏊", "🧠", "✍️", "📵", "🙏", "🦷", "💊", "🥦", "☕", "🎧", "🧊",
];

/**
 * Widget diario de hábitos. Un toque marca; al completar todos → racha +1 con
 * celebración y colapso hasta mañana. El lápiz abre la edición (nombre, emoji
 * con selector, color, borrar, crear — máx. 4).
 */
export function HabitsWidget({ initial }: { initial: HabitsToday }) {
  const router = useRouter();
  const [habits, setHabits] = useState(initial.habits);
  const [streak, setStreak] = useState(initial.streak);
  const [collapsed, setCollapsed] = useState(initial.all_done);
  const [celebrating, setCelebrating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{ id?: string; name: string; emoji: string; color: string } | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const reduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const doneCount = habits.filter((h) => h.done_today).length;

  const burst = () => {
    const box = boxRef.current;
    if (!box || reduced) return;
    for (let i = 0; i < 26; i++) {
      const piece = document.createElement("i");
      piece.style.cssText = `position:absolute;top:-14px;left:${4 + Math.random() * 92}%;width:7px;height:11px;border-radius:2px;background:${CONFETTI[i % CONFETTI.length]};pointer-events:none;z-index:20`;
      box.appendChild(piece);
      piece
        .animate(
          [
            { transform: "translateY(0) rotate(0)", opacity: 1 },
            { transform: `translateY(${140 + Math.random() * 120}px) rotate(${Math.random() > 0.5 ? "" : "-"}${240 + Math.random() * 300}deg)`, opacity: 0 },
          ],
          { duration: 900 + Math.random() * 700, delay: Math.random() * 180, easing: "cubic-bezier(.15,.6,.4,1)", fill: "forwards" }
        )
        .finished.finally(() => piece.remove());
    }
  };

  const toggle = (habitId: string) => {
    setError(null);
    const next = habits.map((h) => (h.id === habitId ? { ...h, done_today: !h.done_today } : h));
    setHabits(next);
    const nowAll = next.length > 0 && next.every((h) => h.done_today);
    const wasAll = habits.length > 0 && habits.every((h) => h.done_today);

    if (nowAll && !wasAll) {
      setStreak((s) => s + 1);
      setCelebrating(true);
      burst();
      window.setTimeout(() => {
        setCelebrating(false);
        setCollapsed(true);
      }, reduced ? 350 : 1800);
    }
    startTransition(async () => {
      const result = await toggleHabitToday(habitId);
      if (!result.ok) {
        setError(result.error ?? "No pudimos registrar el hábito.");
        setHabits(habits);
      }
    });
  };

  const submitForm = () => {
    if (!form) return;
    startTransition(async () => {
      const result = await saveHabit(form);
      if (!result.ok) {
        setError(result.error ?? "No pudimos guardar.");
        return;
      }
      setForm(null);
      setShowEmojis(false);
      setError(null);
      router.refresh();
      // Refresco optimista local para no esperar el round-trip.
      if (form.id) {
        setHabits((prev) => prev.map((h) => (h.id === form.id ? { ...h, ...form } : h)));
      } else {
        setHabits((prev) => [...prev, { id: `tmp-${Date.now()}`, name: form.name, emoji: form.emoji, color: form.color, sort_order: prev.length, done_today: false }]);
      }
    });
  };

  const remove = (habitId: string) => {
    startTransition(async () => {
      const result = await deleteHabit(habitId);
      if (!result.ok) return setError(result.error ?? "No pudimos eliminar.");
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      setForm(null);
      router.refresh();
    });
  };

  if (collapsed && !editing) {
    return (
      <button type="button" onClick={() => setCollapsed(false)} className="gradient-border w-full text-left" data-tour="habitos">
        <div className="flex items-center gap-3 rounded-[calc(1.5rem-1.5px)] bg-[var(--scard)] px-4 py-3.5">
          <span className="text-2xl">🔥</span>
          <span className="min-w-0">
            <span className="block font-heading text-sm font-bold text-[var(--stext)]">{streak} {streak === 1 ? "día" : "días"} de racha</span>
            <span className="block text-xs text-[var(--smut)]">Hábitos del día completos. Nos vemos mañana.</span>
          </span>
          <span className="ml-auto text-xs text-[var(--sdim)]">ver</span>
        </div>
      </button>
    );
  }

  return (
    <div className="relative" ref={boxRef} data-tour="habitos">
      <div className="gradient-border">
        <div className="rounded-[calc(1.5rem-1.5px)] bg-[var(--scard)] p-4">
          <div className="flex items-center gap-2.5">
            <div className="min-w-0">
              <h2 className="font-heading text-base font-bold">Tus hábitos de hoy</h2>
              <p className="text-xs text-[var(--smut)]">
                {habits.length === 0
                  ? "Crea tu primer hábito con el lápiz →"
                  : `${doneCount} de ${habits.length} listos${doneCount === habits.length - 1 && habits.length > 1 ? " · te falta uno" : ""}`}
              </p>
            </div>
            <span className="ml-auto flex flex-none items-center gap-1.5 rounded-full border border-[var(--sline)] bg-[var(--scard2)] px-3 py-1.5 font-heading text-xs font-bold">
              🔥 {streak} {streak === 1 ? "día" : "días"}
            </span>
            <button
              type="button"
              aria-label="Editar hábitos"
              onClick={() => {
                setEditing((v) => !v);
                setForm(null);
                setShowEmojis(false);
                setError(null);
              }}
              className={clsx(
                "flex h-8 w-8 flex-none items-center justify-center rounded-full transition",
                editing ? "bg-[var(--shover)] text-[var(--stext)]" : "text-[var(--sdim)] hover:text-[var(--stext)]"
              )}
            >
              {editing ? <X className="h-4 w-4" /> : <Pencil className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2.5">
            {habits.map((habit) => (
              <button
                key={habit.id}
                type="button"
                onClick={() =>
                  editing
                    ? setForm({ id: habit.id, name: habit.name, emoji: habit.emoji, color: habit.color })
                    : toggle(habit.id)
                }
                style={{ "--hc": habit.color } as React.CSSProperties}
                className={clsx(
                  "flex items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition-all",
                  habit.done_today && !editing
                    ? "border-[color-mix(in_srgb,var(--hc)_55%,transparent)] bg-[color-mix(in_srgb,var(--hc)_14%,var(--scard))]"
                    : "border-[var(--sline)] bg-[var(--scard2)] hover:border-[var(--sline2)]"
                )}
              >
                <span className="text-lg leading-none">{habit.emoji}</span>
                <span className="min-w-0 text-xs font-semibold leading-tight text-[var(--stext)]">{habit.name}</span>
                {editing ? (
                  <Pencil className="ml-auto h-3.5 w-3.5 flex-none text-[var(--sdim)]" />
                ) : (
                  <span
                    className={clsx(
                      "ml-auto flex h-5 w-5 flex-none items-center justify-center rounded-full border-[1.6px] transition-all",
                      habit.done_today ? "border-transparent" : "border-[var(--sline2)]"
                    )}
                    style={habit.done_today ? { background: habit.color } : undefined}
                  >
                    {habit.done_today && <Check className="h-3 w-3 text-black" strokeWidth={3.5} />}
                  </span>
                )}
              </button>
            ))}

            {editing && habits.length < 4 && (
              <button
                type="button"
                onClick={() => {
                  setForm({ name: "", emoji: "✅", color: COLORS[habits.length % COLORS.length] });
                  setShowEmojis(false);
                }}
                className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--sline2)] px-3 py-2.5 text-xs font-semibold text-[var(--smut)] transition hover:border-[var(--stext)] hover:text-[var(--stext)]"
              >
                <Plus className="h-4 w-4" /> Nuevo hábito
              </button>
            )}
          </div>

          {habits.length > 0 && !editing && (
            <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-[var(--shover)]">
              <div
                className="gradient-surface h-full rounded-full transition-all duration-500"
                style={{ width: `${(doneCount / habits.length) * 100}%` }}
              />
            </div>
          )}

          {form && (
            <div className="mt-3.5 space-y-3 rounded-2xl border border-[var(--sline)] bg-[var(--scard2)] p-3.5">
              <div className="flex gap-2.5">
                {/* Emoji: se aprieta y abre el selector */}
                <div className="relative">
                  <button
                    type="button"
                    aria-label="Elegir emoji"
                    onClick={() => setShowEmojis((v) => !v)}
                    className={clsx(
                      "flex h-11 w-14 items-center justify-center rounded-xl border text-lg transition",
                      showEmojis ? "border-stride-cyan bg-[var(--shover)]" : "border-[var(--sline2)] bg-[var(--scard)]"
                    )}
                  >
                    {form.emoji}
                  </button>
                  {showEmojis && (
                    <div className="absolute left-0 top-12 z-30 grid w-64 grid-cols-8 gap-1 rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-2 shadow-xl shadow-black/25">
                      {EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setForm({ ...form, emoji });
                            setShowEmojis(false);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-base transition hover:bg-[var(--shover)]"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nombre (ej: Agua 2 litros)"
                  maxLength={40}
                  className="min-w-0 flex-1 rounded-xl border border-[var(--sline2)] bg-[var(--scard)] px-3 py-2 text-sm outline-none placeholder:text-[var(--sdim)] focus:border-stride-cyan"
                />
              </div>
              <div className="flex items-center gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    onClick={() => setForm({ ...form, color })}
                    className={clsx(
                      "h-6 w-6 rounded-full transition-transform",
                      form.color === color && "scale-110 ring-2 ring-[var(--stext)] ring-offset-2 ring-offset-[var(--scard2)]"
                    )}
                    style={{ background: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={submitForm} className="btn-primary flex-1 px-4 py-2 text-sm">
                  Guardar
                </button>
                {form.id && !form.id.startsWith("tmp-") && (
                  <button
                    type="button"
                    aria-label="Eliminar hábito"
                    onClick={() => remove(form.id!)}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-red-400/40 text-red-400 transition hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setForm(null);
                    setShowEmojis(false);
                  }}
                  className="rounded-full border border-[var(--sline2)] px-4 py-2 text-sm text-[var(--smut)] transition hover:bg-[var(--shover)]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}
          {editing && !form && (
            <p className="mt-3 text-xs text-[var(--sdim)]">
              Toca un hábito para editarlo. Máximo 4 — hacia afuera solo se ve tu constancia, nunca el detalle.
            </p>
          )}
        </div>
      </div>

      {/* Celebración: tarjeta con fondo para que se lea sobre cualquier contenido */}
      {celebrating && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div
            className="m-rowin rounded-2xl border border-white/15 px-8 py-5 text-center shadow-2xl shadow-black/60"
            style={{ background: "rgba(8, 8, 12, 0.96)" }}
          >
            <div className="text-4xl">🔥</div>
            <div className="wordmark mt-1 font-heading text-xl font-extrabold">
              ¡Día {streak} seguido!
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

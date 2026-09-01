import { memberDisplayName } from "@/lib/community-shared";
import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3, LogOut, MessageCircle, Settings, ShieldAlert, UserRound } from "lucide-react";
import clsx from "clsx";
import { getCurrentMember, getSignedMemberPhoto } from "@/lib/member-auth";
import { formatDateCL, isMembershipValid } from "@/lib/membership";
import { rotatingQrUrl } from "@/lib/rotating-qr";
import { SITE, whatsappLink } from "@/lib/site";
import { getAttendanceStats, getHabitsToday, getVitrina } from "@/lib/community";
import { RotatingMemberQR } from "@/components/member/RotatingMemberQR";
import { PhotoUploader } from "@/components/member/PhotoUploader";
import { InstallCard } from "@/components/member/InstallCard";
import { PhysicalMedalForm } from "@/components/community/PhysicalMedalForm";
import { MedalGrid } from "@/components/community/MedalModal";
import { signOutMember } from "../actions";

export const dynamic = "force-dynamic";

/** Perfil de corredor: el carnet que crece. */
export default async function PerfilPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/miembros"); // el staff sin ficha no tiene carnet

  const [photoUrl, habits, attendance, vitrina] = await Promise.all([
    getSignedMemberPhoto(member),
    getHabitsToday(member.id),
    getAttendanceStats(member.id),
    getVitrina(member.id),
  ]);

  const valid = isMembershipValid(member);
  const initialQr = valid ? rotatingQrUrl(member.member_code, SITE.url) : null;
  const supportUrl = whatsappLink(
    `Hola! Soy ${member.full_name} y necesito ayuda con mi membresía STRIDE ONE.`
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* ── Carnet (intacto) ── */}
      <section
        className={clsx(
          "overflow-hidden rounded-2xl border",
          valid ? "border-stride-accent/40 bg-[var(--scard)]" : "border-red-500/50 bg-red-950/20"
        )}
      >
        <div className="gradient-surface h-1" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sdim)]">Carnet digital</p>
              <h1 className="mt-1 font-heading text-2xl font-bold">STRIDE ONE</h1>
            </div>
            <span
              className={clsx(
                "rounded-full px-3 py-1.5 text-xs font-bold uppercase",
                valid ? "bg-emerald-500/12 text-emerald-500" : "bg-red-500/15 text-red-400"
              )}
            >
              {valid ? "Activa" : member.status === "pausada" ? "Pausada" : "No vigente"}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-4">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={memberDisplayName(member)}
                width={80}
                height={80}
                unoptimized
                className="h-20 w-20 rounded-2xl border border-[var(--sline2)] object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--sline2)] bg-[var(--scard2)]">
                <UserRound className="h-8 w-8 text-[var(--sdim)]" />
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-heading text-xl font-bold">{memberDisplayName(member)}</p>
              <p className="mt-1 font-mono text-xs tracking-[0.18em] text-[var(--sdim)]">{member.member_code}</p>
              <p className="mt-1.5 text-xs text-[var(--sdim)]">Miembro desde {formatDateCL(member.joined_at)}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 rounded-xl bg-[var(--scard2)] p-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--sdim)]">Estado</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                {valid ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <ShieldAlert className="h-4 w-4 text-red-400" />}
                {valid ? "Membresía vigente" : "Membresía no vigente"}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[var(--sdim)]">Vigente hasta</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                <Clock3 className="h-4 w-4 text-stride-accent" />
                {formatDateCL(member.valid_until)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-col items-center border-t border-[var(--sline)] pt-5">
            {initialQr ? (
              <RotatingMemberQR initial={initialQr} />
            ) : (
              <div className="w-full rounded-xl border border-red-400/25 bg-red-500/10 p-6 text-center">
                <ShieldAlert className="mx-auto h-10 w-10 text-red-400" />
                <p className="mt-3 font-heading font-bold text-red-300">QR desactivado</p>
                <p className="mt-1 text-sm text-red-300/70">Reactiva tu membresía para volver a usar los beneficios.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <InstallCard />

      {/* ── Tus números ── */}
      <section>
        <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
          Tus números
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat n={`${attendance.total}`} label="Social Runs" />
          <Stat n={`${attendance.weekStreak}`} label="semanas de racha" />
          <Stat n={`${habits.streak}`} label="días de hábitos" />
          <Stat n={`${vitrina.filter((m) => m.status === "otorgada").length}`} label="medallas" />
        </div>
      </section>

      {/* ── Vitrina ── */}
      <section>
        <h2 className="mb-2.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--sdim)]">
          Vitrina de medallas
        </h2>
        <MedalGrid medals={vitrina}>
          <PhysicalMedalForm />
        </MedalGrid>
        {vitrina.length === 0 && (
          <p className="mt-2 px-1 text-xs text-[var(--sdim)]">
            Tus medallas de retos e hitos aparecerán aquí. Ve a Retos para ganar la primera.
          </p>
        )}
      </section>

      {/* ── Hábitos: historial privado (degradado que avanza con la constancia) ── */}
      <section className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5">
        <h2 className="font-heading text-base font-bold">Tus hábitos · últimos 14 días</h2>
        <div className="mt-3.5 grid gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0,1fr))" }}>
          {[...habits.last14].reverse().map((done, index) => (
            <div
              key={index}
              className={clsx("aspect-square rounded-md", !done && "bg-[var(--shover)]", index === 13 && "ring-1 ring-stride-cyan")}
              style={done ? { background: streakGradient(index / 13) } : undefined}
            />
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--sdim)]">
          Solo tú ves este detalle. Hacia afuera, los demás solo ven tu constancia.
        </p>
      </section>

      {/* ── Datos + soporte + salir ── */}
      <section className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold">Tus datos</h2>
          <Link
            href="/miembros/config"
            className="flex items-center gap-1.5 rounded-full border border-[var(--sline2)] px-3.5 py-1.5 text-xs font-semibold text-[var(--smut)] transition hover:bg-[var(--shover)] hover:text-[var(--stext)]"
          >
            <Settings className="h-3.5 w-3.5" /> Configuración
          </Link>
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <ProfileItem label="Email" value={member.email ?? "—"} />
          <ProfileItem label="WhatsApp" value={member.whatsapp ?? "—"} />
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <PhotoUploader />
          <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-4 py-2 text-sm">
            <MessageCircle className="h-4 w-4" /> Hablar con STRIDE
          </a>
          <form action={signOutMember}>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--sline2)] px-4 py-2 text-sm text-[var(--smut)] hover:bg-[var(--shover)]"
            >
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </form>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-[var(--sdim)]">
          Los demás miembros ven tu nombre, foto, medallas y racha de asistencia. Nunca: el detalle de tus
          hábitos, tu QR ni tu estado de pago.
        </p>
      </section>
    </div>
  );
}

/** Degradado de marca cian → índigo → morado a lo largo de la grilla. */
function streakGradient(t: number): string {
  const stops = [
    [0x00, 0xe5, 0xff],
    [0x63, 0x66, 0xf1],
    [0x7c, 0x3a, 0xed],
  ];
  const seg = t < 0.5 ? 0 : 1;
  const local = (t - seg * 0.5) * 2;
  const mix = stops[seg].map((from, i) => Math.round(from + (stops[seg + 1][i] - from) * local));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[var(--sline)] bg-[var(--scard)] px-4 py-3.5">
      <p className="wordmark font-heading text-2xl font-extrabold">{n}</p>
      <p className="mt-0.5 text-[11px] text-[var(--sdim)]">{label}</p>
    </div>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--scard2)] p-3">
      <dt className="text-xs text-[var(--sdim)]">{label}</dt>
      <dd className="mt-1 break-all text-[var(--smut)]">{value}</dd>
    </div>
  );
}

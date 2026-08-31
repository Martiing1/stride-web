import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, Clock3, LogOut, MessageCircle, ShieldAlert, Sparkles, UserRound } from "lucide-react";
import { getCurrentMember, getSignedMemberPhoto } from "@/lib/member-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { formatDateCL, isMembershipValid, todayInChile } from "@/lib/membership";
import { rotatingQrUrl } from "@/lib/rotating-qr";
import { SITE, whatsappLink } from "@/lib/site";
import { RotatingMemberQR } from "@/components/member/RotatingMemberQR";
import { PhotoUploader } from "@/components/member/PhotoUploader";
import { InstallCard } from "@/components/member/InstallCard";
import { signOutMember } from "./actions";
import type { Benefit, StrideEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MembersPortalPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/miembros/ingresar");

  const service = createServiceClient();
  const [{ data: benefitsData }, { data: eventsData }, photoUrl] = await Promise.all([
    service.from("benefits").select("id, business_name, category, description, discount_label, address, instagram, logo_url, active, sort_order, created_at").eq("active", true).order("sort_order"),
    service.from("events").select("*").eq("is_public", true).eq("status", "confirmado").gte("event_date", todayInChile()).order("event_date").limit(3),
    getSignedMemberPhoto(member),
  ]);

  const benefits = (benefitsData ?? []) as Benefit[];
  const events = (eventsData ?? []) as StrideEvent[];
  const valid = isMembershipValid(member);
  const initialQr = valid ? rotatingQrUrl(member.member_code, SITE.url) : null;
  const supportUrl = whatsappLink(valid
    ? `Hola cabros! Soy ${member.full_name} y necesito ayuda con mi membresía STRIDE ONE.`
    : `Hola cabros! Soy ${member.full_name} y quiero reactivar mi membresía STRIDE ONE.`);

  return (
    <main className="min-h-dvh bg-stride-bg px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/" className="font-heading text-xl font-extrabold tracking-tight wordmark">STRIDE ONE</Link>
          <form action={signOutMember}><button type="submit" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white"><LogOut className="h-3.5 w-3.5" /> Salir</button></form>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)]">
          <div className="space-y-6">
            <section className={`overflow-hidden rounded-[2rem] border ${valid ? "border-stride-accent/45 bg-stride-card" : "border-red-500/50 bg-red-950/25"}`}>
              <div className="gradient-surface h-1.5" />
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/35">Carnet digital</p><h1 className="mt-2 font-heading text-2xl font-extrabold">STRIDE ONE</h1></div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase ${valid ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>{valid ? "Activa" : member.status === "pausada" ? "Pausada" : "No vigente"}</span>
                </div>

                <div className="mt-6 flex items-center gap-4">
                  {photoUrl ? <Image src={photoUrl} alt={member.full_name} width={80} height={80} unoptimized className="h-20 w-20 rounded-2xl border border-white/10 object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5"><UserRound className="h-8 w-8 text-white/30" /></div>}
                  <div className="min-w-0"><p className="truncate font-heading text-xl font-bold">{member.full_name}</p><p className="mt-1 font-mono text-xs tracking-[0.18em] text-white/45">{member.member_code}</p><p className="mt-2 text-xs text-white/45">Miembro desde {formatDateCL(member.joined_at)}</p></div>
                </div>

                <div className="mt-6 grid gap-3 rounded-2xl bg-black/20 p-4 sm:grid-cols-2">
                  <div><p className="text-[11px] uppercase tracking-wide text-white/35">Estado</p><p className="mt-1 flex items-center gap-2 text-sm font-semibold">{valid ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-red-400" />}{valid ? "Membresía vigente" : "Membresía no vigente"}</p></div>
                  <div><p className="text-[11px] uppercase tracking-wide text-white/35">Vigente hasta</p><p className="mt-1 flex items-center gap-2 text-sm font-semibold"><Clock3 className="h-4 w-4 text-stride-cyan" />{formatDateCL(member.valid_until)}</p></div>
                </div>

                <div className="mt-6 flex flex-col items-center border-t border-white/5 pt-6">
                  {initialQr ? <RotatingMemberQR initial={initialQr} /> : <div className="w-full rounded-2xl border border-red-400/20 bg-red-500/10 p-6 text-center"><ShieldAlert className="mx-auto h-10 w-10 text-red-300" /><p className="mt-3 font-heading font-bold text-red-200">QR desactivado</p><p className="mt-1 text-sm text-red-200/60">Reactiva tu membresía para volver a usar los beneficios.</p></div>}
                </div>
              </div>
            </section>

            <InstallCard />

            <section className="member-panel">
              <h2 className="font-heading text-lg font-bold">Tus datos</h2>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><ProfileItem label="Email" value={member.email ?? "—"} /><ProfileItem label="WhatsApp" value={member.whatsapp ?? "—"} /></dl>
              <div className="mt-5 flex flex-wrap items-start gap-3"><PhotoUploader /><a href={supportUrl} target="_blank" rel="noopener noreferrer" className="btn-whatsapp px-4 py-2 text-sm"><MessageCircle className="h-4 w-4" /> Solicitar corrección</a></div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="member-panel">
              <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-stride-cyan" /><h2 className="font-heading text-lg font-bold">Beneficios disponibles</h2></div>
              {benefits.length ? <ul className="mt-4 space-y-3">{benefits.map((benefit) => <li key={benefit.id} className="rounded-2xl border border-white/5 bg-black/15 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{benefit.business_name}</p><p className="mt-1 text-xs capitalize text-white/40">{benefit.category}</p></div>{benefit.discount_label && <span className="rounded-full bg-stride-accent/15 px-2.5 py-1 text-xs font-bold text-stride-cyan">{benefit.discount_label}</span>}</div><p className="mt-3 text-sm leading-relaxed text-white/55">{benefit.description}</p>{benefit.member_note && <p className="mt-2 rounded-xl border border-stride-cyan/25 bg-stride-cyan/10 px-3 py-2 text-sm font-semibold text-stride-cyan">{benefit.member_note}</p>}</li>)}</ul> : <Empty text="Los próximos convenios aparecerán aquí." />}
            </section>

            <section className="member-panel">
              <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-stride-cyan" /><h2 className="font-heading text-lg font-bold">Próximos Social Runs</h2></div>
              {events.length ? <ul className="mt-4 space-y-3">{events.map((event) => <li key={event.id} className="rounded-2xl border border-white/5 bg-black/15 p-4"><p className="font-semibold">{event.title}</p><p className="mt-1 text-sm text-white/50">{formatDateCL(event.event_date)}{event.event_time ? ` · ${event.event_time.slice(0, 5)} hrs` : ""}</p>{event.meeting_point && <p className="mt-2 text-xs text-white/35">{event.meeting_point}</p>}</li>)}</ul> : <Empty text="Te avisaremos cuando confirmemos la próxima fecha." />}
            </section>

            <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="btn-whatsapp w-full"><MessageCircle className="h-5 w-5" />{valid ? "Hablar con STRIDE" : "Reactivar por WhatsApp"}</a>
          </div>
        </div>
      </div>
    </main>
  );
}

function ProfileItem({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-white/[0.03] p-3"><dt className="text-xs text-white/35">{label}</dt><dd className="mt-1 break-all text-white/75">{value}</dd></div>; }
function Empty({ text }: { text: string }) { return <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-5 text-sm text-white/40">{text}</p>; }

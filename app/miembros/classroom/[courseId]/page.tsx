import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentMember, getCommunityStaff } from "@/lib/member-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { safeQuery } from "@/lib/safe-query";
import { todayInChile } from "@/lib/membership";
import { LessonAccordion } from "@/components/community/LessonAccordion";
import { LessonAdminPanel } from "@/components/community/LessonAdminPanel";

export const dynamic = "force-dynamic";

interface Lesson {
  id: string;
  title: string;
  video_url: string | null;
  content_md: string | null;
  duration_label: string | null;
  sort_order: number;
}

/** Detalle de un curso: lecciones con video embebido y progreso personal. */
export default async function CoursePage({ params }: { params: Promise<{ courseId: string }> }) {
  const [member, staff] = await Promise.all([getCurrentMember(), getCommunityStaff()]);
  const { courseId } = await params;
  const service = createServiceClient();

  const course = await safeQuery(
    () =>
      service
        .from("courses")
        .select("id, title, subtitle, emoji, category, opens_month, active")
        .eq("id", courseId)
        .maybeSingle(),
    null as { id: string; title: string; subtitle: string | null; emoji: string; category: string; opens_month: string | null; active: boolean } | null
  );
  if (!course || !course.active) notFound();

  // Drip: una etapa futura no se abre ni con el link directo.
  const monthStart = todayInChile().slice(0, 7) + "-01";
  if (course.category === "etapa" && course.opens_month && course.opens_month > monthStart) {
    redirect("/miembros/classroom");
  }

  const [lessons, progress] = await Promise.all([
    safeQuery(
      () =>
        service
          .from("course_lessons")
          .select("id, title, video_url, content_md, duration_label, sort_order")
          .eq("course_id", courseId)
          .order("sort_order"),
      [] as Lesson[]
    ),
    member
      ? safeQuery(
          () => service.from("lesson_progress").select("lesson_id").eq("member_id", member.id),
          [] as Array<{ lesson_id: string }>
        )
      : Promise.resolve([] as Array<{ lesson_id: string }>),
  ]);
  const doneSet = new Set(progress.map((p) => p.lesson_id));
  const accordionLessons = lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    video_url: lesson.video_url,
    content_md: lesson.content_md,
    duration_label: lesson.duration_label,
    done: doneSet.has(lesson.id),
  }));

  return (
    <div className="space-y-5">
      <Link href="/miembros/classroom" className="inline-flex items-center gap-2 text-sm text-[var(--smut)] hover:text-[var(--stext)]">
        <ArrowLeft className="h-4 w-4" /> Classroom
      </Link>

      <header>
        <h1 className="font-heading text-2xl font-extrabold">
          {course.emoji} {course.title}
        </h1>
        {course.subtitle && <p className="mt-1 text-sm text-[var(--smut)]">{course.subtitle}</p>}
      </header>

      {staff && <LessonAdminPanel courseId={courseId} lessons={accordionLessons} />}

      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--sline2)] p-10 text-center">
          <p className="font-heading font-bold">Las lecciones vienen en camino</p>
          <p className="mt-1 text-sm text-[var(--smut)]">El staff está preparando el contenido de este módulo.</p>
        </div>
      ) : (
        <LessonAccordion lessons={accordionLessons} />
      )}
    </div>
  );
}

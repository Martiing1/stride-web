"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireTeamMember } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseActa, resolveAssignee } from "@/lib/acta-parser";
import type { TeamMember } from "@/lib/types";

const TaskOverrideSchema = z.array(
  z.object({
    title: z.string().trim().min(3).max(300),
    assigneeLabel: z.string().trim().max(120),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    priority: z.enum(["alta", "media", "baja"]),
    area: z.string().trim().max(80),
  })
).max(50);

const ActaSchema = z.object({
  title: z.string().trim().min(3, "Ponle un título al acta").max(200),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  attendees: z.string().max(500).optional(),
  content: z.string().trim().min(20, "El acta está vacía"),
});

export interface SaveActaResult {
  ok: boolean;
  error?: string;
  meetingId?: string;
  created?: { tasks: number; decisions: number; followups: number };
  warnings?: string[];
}

/**
 * Guarda un acta y desglosa su bloque AUTO_PROCESSING en tareas, decisiones y
 * seguimientos.
 *
 * El parseo se rehace acá aunque el cliente ya mostró una previsualización: lo
 * que llega del navegador es solo texto, nunca las filas a insertar.
 */
export async function saveActa(formData: FormData): Promise<SaveActaResult> {
  const member = await requireTeamMember(["socio", "lider_comunidad"]);

  const parsed = ActaSchema.safeParse({
    title: formData.get("title"),
    meeting_date: formData.get("meeting_date"),
    attendees: formData.get("attendees"),
    content: formData.get("content"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { title, meeting_date, attendees, content } = parsed.data;
  const acta = parseActa(content);

  // Las tareas pueden venir corregidas desde la previsualización (fechas
  // "A definir", responsables, prioridades). Si llegan, mandan ellas.
  const overrideRaw = formData.get("tasks_override");
  if (typeof overrideRaw === "string" && overrideRaw) {
    try {
      const override = TaskOverrideSchema.safeParse(JSON.parse(overrideRaw));
      if (override.success) {
        acta.tasks = override.data.map((t) => ({
          actaCode: acta.actaCode ?? "",
          assigneeLabel: t.assigneeLabel || "Sin asignar",
          dueDate: t.dueDate,
          priority: t.priority,
          area: t.area || "general",
          title: t.title,
        }));
      }
    } catch {
      /* JSON malo: se usan las parseadas tal cual */
    }
  }
  const supabase = await createClient();

  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      code: acta.actaCode,
      title,
      meeting_date,
      attendees: attendees
        ? attendees.split(",").map((a) => a.trim()).filter(Boolean)
        : [],
      content_md: acta.contentWithoutBlock || content,
      raw_block: acta.rawBlock,
      created_by: member.id,
    })
    .select("id")
    .single();

  if (meetingError || !meeting) {
    // Un code duplicado significa que el acta ya se subió antes.
    const duplicate = meetingError?.code === "23505";
    return {
      ok: false,
      error: duplicate
        ? `Ya existe un acta con el código ${acta.actaCode}. Revisa si la subiste antes.`
        : "No se pudo guardar el acta.",
    };
  }

  // Se necesita el equipo para enlazar cada responsable del acta a una persona.
  const { data: teamData } = await supabase
    .from("team_members")
    .select("id, full_name, nickname")
    .eq("status", "activo");

  const team = (teamData ?? []) as Pick<TeamMember, "id" | "full_name" | "nickname">[];

  const warnings = [...acta.warnings];
  let tasksCreated = 0;

  if (acta.tasks.length > 0) {
    const rows = acta.tasks.map((task) => {
      const assigneeId = resolveAssignee(task.assigneeLabel, team);
      if (!assigneeId) {
        warnings.push(
          `"${task.assigneeLabel}" no se pudo asignar a una sola persona: la tarea queda sin responsable directo.`
        );
      }
      return {
        title: task.title,
        assignee_id: assigneeId,
        assignee_label: task.assigneeLabel,
        area: task.area,
        priority: task.priority,
        status: "pendiente" as const,
        due_date: task.dueDate,
        meeting_id: meeting.id,
      };
    });

    const { error, count } = await supabase.from("tasks").insert(rows, { count: "exact" });
    if (error) warnings.push("Algunas tareas no se pudieron guardar.");
    else tasksCreated = count ?? rows.length;
  }

  if (acta.decisions.length > 0) {
    await supabase.from("decisions").insert(
      acta.decisions.map((d) => ({
        meeting_id: meeting.id,
        area: d.area,
        kind: d.kind,
        priority: d.priority,
        content: d.content,
        is_doc_update: d.isDocUpdate,
      }))
    );
  }

  if (acta.followups.length > 0) {
    await supabase.from("followups").insert(
      acta.followups.map((f) => ({
        meeting_id: meeting.id,
        area: f.area,
        content: f.content,
      }))
    );
  }

  revalidatePath("/admin/actas");
  revalidatePath("/admin/tareas");
  revalidatePath("/admin");

  return {
    ok: true,
    meetingId: meeting.id,
    created: {
      tasks: tasksCreated,
      decisions: acta.decisions.length,
      followups: acta.followups.length,
    },
    warnings,
  };
}

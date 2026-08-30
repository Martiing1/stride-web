/**
 * Parser del bloque AUTO_PROCESSING de las actas STRIDE.
 *
 * Flujo: Martín manda la transcripción a una IA, la IA devuelve el acta con un
 * bloque AUTO_PROCESSING al final, y él pega esa acta completa en el ERP.
 * Este parser desglosa ese bloque en tareas, decisiones y seguimientos.
 *
 * Formato (campos separados por " | "):
 *   AUTO_PROCESSING_START
 *   CATALOG_VERSION | <version>
 *   AREA        | <area> | <prioridad> | <keywords>
 *   DECISION    | <area> | <tipo> | <prioridad> | <contenido>
 *   DOC_UPDATE  | <area> | <tipo> | <prioridad> | <contenido>
 *   TAREA       | <id_acta> | <responsable> | <DD/MM/YYYY> | <prioridad> | <area> | <descripcion>
 *   SEGUIMIENTO | <area> | <contenido>
 *   AUTO_PROCESSING_END
 */

export type Priority = "alta" | "media" | "baja";

export interface ParsedTask {
  actaCode: string;
  assigneeLabel: string;
  dueDate: string | null; // ISO YYYY-MM-DD
  priority: Priority;
  area: string;
  title: string;
}

export interface ParsedDecision {
  area: string;
  kind: string;
  priority: Priority;
  content: string;
  isDocUpdate: boolean;
}

export interface ParsedFollowup {
  area: string;
  content: string;
}

export interface ParsedHeader {
  meetingDate: string | null; // ISO YYYY-MM-DD
  timeLabel: string | null;
  durationLabel: string | null;
  attendees: string[];
  location: string | null;
  titleSuggestion: string | null;
}

export interface ParsedActa {
  /** Con qué formato se entendió el acta. */
  format: "auto_processing" | "erp_os" | "none";
  /** Datos del encabezado (solo formato erp_os). */
  header: ParsedHeader | null;
  hasBlock: boolean;
  catalogVersion: string | null;
  actaCode: string | null;
  areas: string[];
  tasks: ParsedTask[];
  decisions: ParsedDecision[];
  followups: ParsedFollowup[];
  rawBlock: string | null;
  /** Acta sin el bloque técnico, que es lo que se muestra como acta legible. */
  contentWithoutBlock: string;
  warnings: string[];
}

const START = "AUTO_PROCESSING_START";
const END = "AUTO_PROCESSING_END";

function normalizePriority(value: string | undefined, warnings: string[], context: string): Priority {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "alta" || v === "media" || v === "baja") return v;
  if (v) warnings.push(`Prioridad no reconocida ("${value}") en ${context}, se usó "media".`);
  return "media";
}

/**
 * Convierte DD/MM/YYYY (formato de las actas) a YYYY-MM-DD.
 * Devuelve null si viene vacío o no calza, para no inventar fechas límite.
 */
function parseDate(value: string | undefined, warnings: string[], context: string): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    warnings.push(`Fecha no reconocida ("${raw}") en ${context}, la tarea queda sin fecha límite.`);
    return null;
  }

  const [, d, m, y] = match;
  const day = Number(d);
  const month = Number(m);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    warnings.push(`Fecha inválida ("${raw}") en ${context}, la tarea queda sin fecha límite.`);
    return null;
  }

  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function parseActa(content: string): ParsedActa {
  const warnings: string[] = [];
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    if (startIdx !== -1) {
      warnings.push("El bloque AUTO_PROCESSING está incompleto (falta AUTO_PROCESSING_END).");
    }
    // Formato vigente desde 2026-08: sin bloque técnico, con secciones numeradas
    // y las tareas en líneas "NUEVA | …" bajo "Formato de registro en ERP/OS".
    return parseErpOsActa(content, warnings);
  }

  const rawBlock = content.slice(startIdx, endIdx + END.length);
  const contentWithoutBlock = (
    content.slice(0, startIdx) + content.slice(endIdx + END.length)
  ).trim();

  const lines = rawBlock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== START && l !== END);

  const areas = new Set<string>();
  const tasks: ParsedTask[] = [];
  const decisions: ParsedDecision[] = [];
  const followups: ParsedFollowup[] = [];
  let catalogVersion: string | null = null;
  let actaCode: string | null = null;

  for (const line of lines) {
    const parts = line.split("|").map((p) => p.trim());
    const kind = parts[0]?.toUpperCase();

    switch (kind) {
      case "CATALOG_VERSION":
        catalogVersion = parts[1] ?? null;
        break;

      case "AREA":
        if (parts[1]) areas.add(parts[1]);
        break;

      case "DECISION":
      case "DOC_UPDATE": {
        // TIPO | area | kind | prioridad | contenido
        if (parts.length < 5) {
          warnings.push(`Línea ${kind} incompleta, se omitió: "${line}"`);
          break;
        }
        decisions.push({
          area: parts[1],
          kind: parts[2],
          priority: normalizePriority(parts[3], warnings, kind),
          content: parts.slice(4).join(" | "),
          isDocUpdate: kind === "DOC_UPDATE",
        });
        break;
      }

      case "TAREA": {
        // TAREA | id_acta | responsable | fecha | prioridad | area | descripcion
        if (parts.length < 7) {
          warnings.push(`Línea TAREA incompleta, se omitió: "${line}"`);
          break;
        }
        const [, code, assignee, due, priority, area] = parts;
        if (!actaCode && code) actaCode = code;
        tasks.push({
          actaCode: code,
          assigneeLabel: assignee,
          dueDate: parseDate(due, warnings, `tarea "${parts.slice(6).join(" | ")}"`),
          priority: normalizePriority(priority, warnings, "TAREA"),
          area,
          // El separador puede aparecer dentro del texto: se reconstruye el resto.
          title: parts.slice(6).join(" | "),
        });
        break;
      }

      case "SEGUIMIENTO": {
        if (parts.length < 3) {
          warnings.push(`Línea SEGUIMIENTO incompleta, se omitió: "${line}"`);
          break;
        }
        followups.push({ area: parts[1], content: parts.slice(2).join(" | ") });
        break;
      }

      default:
        warnings.push(`Tipo de línea desconocido, se omitió: "${line}"`);
    }
  }

  return {
    format: "auto_processing",
    header: null,
    hasBlock: true,
    catalogVersion,
    actaCode,
    areas: Array.from(areas),
    tasks,
    decisions,
    followups,
    rawBlock,
    contentWithoutBlock,
    warnings,
  };
}

/**
 * Resuelve el responsable literal del acta ("Nicolás / Fernanda", "Martín",
 * "Equipo de planificación") a una persona del equipo.
 *
 * Solo enlaza cuando hay UNA coincidencia inequívoca: los responsables
 * compuestos quedan como texto en assignee_label para que alguien los asigne
 * a mano, en vez de adjudicárselos a la primera persona que calce.
 */
export function resolveAssignee(
  label: string,
  team: Array<{ id: string; full_name: string; nickname: string | null }>
): string | null {
  const strip = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  const normalized = strip(label);

  if (normalized.includes("/") || normalized.includes(" y ") || normalized.includes("equipo")) {
    return null;
  }

  const matches = team.filter((m) => {
    const candidates = [m.full_name, m.nickname ?? ""].map(strip).filter(Boolean);
    return candidates.some((c) => normalized === c || normalized.includes(c));
  });

  return matches.length === 1 ? matches[0].id : null;
}

// ─── Formato "ERP/OS" (vigente desde 2026-08) ────────────────────────────────
//
// El acta viene como documento estructurado: encabezado en tabla (Fecha, Hora,
// Duración, Participantes, Ubicación), secciones numeradas (1. RESUMEN … 7.
// NOTAS) y, dentro de "5. TAREAS", un bloque "Formato de registro en ERP/OS:"
// con una línea por tarea:
//
//   NUEVA | <descripción> | <responsable> | <DD/MM/YYYY> | <prioridad> | <categoría>
//
// Al pegar desde Word/Docs las celdas de tabla llegan como tabs o como "|";
// todo se normaliza antes de leer.

const SECTION_HEADING = /^\s*\d+\s*[.)]\s+[A-ZÁÉÍÓÚÑ]/;

function cleanCell(value: string): string {
  return value.replace(/^[|\s•·\-–]+/, "").replace(/[|\s]+$/, "").trim();
}

/** Busca el valor de un campo del encabezado ("Fecha:", "Participantes:", …). */
function headerField(lines: string[], key: RegExp): string | null {
  const KEYS = /^(fecha|hora|duraci[oó]n|participantes|ubicaci[oó]n|reuni[oó]n\s*n)/i;
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const line = cleanCell(lines[i]);
    const match = line.match(key);
    if (!match) continue;

    // Valor en la misma línea, después de los dos puntos…
    const inline = cleanCell(line.slice(match[0].length).replace(/^:/, ""));
    if (inline) return inline;

    // …o en las celdas siguientes, hasta toparse con otra clave o una sección.
    const parts: string[] = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
      const next = cleanCell(lines[j]);
      if (!next) continue;
      if (KEYS.test(next) || SECTION_HEADING.test(next)) break;
      parts.push(next);
      // Los campos cortos (fecha, hora) viven en una sola celda.
      if (!/participantes/i.test(match[0])) break;
    }
    const joined = parts.join(" ").trim();
    return joined || null;
  }
  return null;
}

/** Junta las líneas de una sección numerada hasta el siguiente encabezado. */
function sectionLines(lines: string[], heading: RegExp): string[] {
  const start = lines.findIndex((l) => heading.test(cleanCell(l)));
  if (start === -1) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = cleanCell(lines[i]);
    if (SECTION_HEADING.test(line) || /^formato de registro/i.test(line)) break;
    if (line) out.push(line);
  }
  return out;
}

function parseErpOsActa(content: string, warnings: string[]): ParsedActa {
  // Tabs de tablas pegadas desde Word → mismo separador que el formato escrito.
  const normalized = content.replace(/\t+/g, " | ");
  const lines = normalized.split(/\r?\n/);

  // --- Tareas: líneas "NUEVA | …" ---
  const tasks: ParsedTask[] = [];
  const taskLineIdx: number[] = [];
  lines.forEach((raw, i) => {
    const line = cleanCell(raw);
    if (!/^NUEVA\s*\|/i.test(line)) return;
    taskLineIdx.push(i);

    const parts = line.split("|").map((p) => p.trim()).filter((p, idx) => idx === 0 || p !== "");
    // [NUEVA, descripción…, responsable, fecha, prioridad, categoría]
    if (parts.length < 6) {
      warnings.push(`Línea NUEVA incompleta, se omitió: "${line}"`);
      return;
    }
    const tail = parts.slice(-4); // responsable, fecha, prioridad, categoría
    const title = parts.slice(1, parts.length - 4).join(" | ");
    tasks.push({
      actaCode: "",
      assigneeLabel: tail[0],
      dueDate: parseDate(tail[1], warnings, `tarea "${title}"`),
      priority: normalizePriority(tail[2], warnings, "NUEVA"),
      area: tail[3] || "general",
      title,
    });
  });

  // --- Decisiones y seguimientos desde las secciones numeradas ---
  const decisions: ParsedDecision[] = sectionLines(lines, /^\d+\s*[.)]\s+DECISIONES/i).map(
    (line) => ({ area: "general", kind: "decision", priority: "media" as Priority, content: line, isDocUpdate: false })
  );
  const followups: ParsedFollowup[] = sectionLines(lines, /^\d+\s*[.)]\s+SEGUIMIENTO/i).map(
    (line) => ({ area: "general", content: line })
  );

  // --- Encabezado ---
  const dateLabel = headerField(lines, /^fecha\b:?/i);
  const meetingDate = dateLabel ? parseDate(dateLabel.match(/\d{1,2}\/\d{1,2}\/\d{4}/)?.[0], [], "encabezado") : null;
  const attendeesRaw = headerField(lines, /^participantes\b:?/i) ?? "";
  const attendees = attendeesRaw
    .split(/[,;]| y /i)
    .map((a) => a.trim())
    .filter((a) => a && a.length < 60);

  let titleSuggestion: string | null = null;
  const actaHeadingIdx = lines.findIndex((l) => /ACTA DE REUNI[ÓO]N/i.test(l));
  for (let i = actaHeadingIdx + 1; i >= 0 && i < Math.min(lines.length, actaHeadingIdx + 5); i++) {
    const line = cleanCell(lines[i]);
    if (line && !/ACTA DE REUNI/i.test(line) && !/^(fecha|hora|duraci)/i.test(line)) {
      titleSuggestion = line;
      break;
    }
  }

  const header: ParsedHeader = {
    meetingDate,
    timeLabel: headerField(lines, /^hora\b:?/i),
    durationLabel: headerField(lines, /^duraci[oó]n\b:?/i),
    attendees,
    location: headerField(lines, /^ubicaci[oó]n\b:?/i),
    titleSuggestion,
  };

  // --- Bloque técnico fuera de la vista legible ---
  let rawBlock: string | null = null;
  let contentWithoutBlock = content.trim();
  if (taskLineIdx.length > 0) {
    const blockStart = lines.findIndex((l) => /^formato de registro/i.test(cleanCell(l)));
    const from = blockStart !== -1 ? blockStart : taskLineIdx[0];
    const to = taskLineIdx[taskLineIdx.length - 1];
    rawBlock = lines.slice(from, to + 1).join("\n");
    contentWithoutBlock = [...lines.slice(0, from), ...lines.slice(to + 1)].join("\n").trim();
  }

  const actaCode = meetingDate ? `ACTA_STRIDE_${meetingDate.replace(/-/g, "")}` : null;
  const found = tasks.length + decisions.length + followups.length > 0;
  if (!found) {
    warnings.push(
      "No se reconoció ningún formato: ni bloque AUTO_PROCESSING ni líneas 'NUEVA | …'. Se guardará sin desglosar."
    );
  }

  return {
    format: found ? "erp_os" : "none",
    header,
    hasBlock: found,
    catalogVersion: null,
    actaCode,
    areas: Array.from(new Set(tasks.map((t) => t.area))),
    tasks: tasks.map((t) => ({ ...t, actaCode: actaCode ?? "" })),
    decisions,
    followups,
    rawBlock,
    contentWithoutBlock,
    warnings,
  };
}

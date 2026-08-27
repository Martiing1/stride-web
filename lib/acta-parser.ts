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

export interface ParsedActa {
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
    return {
      hasBlock: false,
      catalogVersion: null,
      actaCode: null,
      areas: [],
      tasks: [],
      decisions: [],
      followups: [],
      rawBlock: null,
      contentWithoutBlock: content.trim(),
      warnings: startIdx === -1
        ? ["El acta no trae bloque AUTO_PROCESSING: se guardará sin desglosar tareas."]
        : ["El bloque AUTO_PROCESSING está incompleto (falta AUTO_PROCESSING_END)."],
    };
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

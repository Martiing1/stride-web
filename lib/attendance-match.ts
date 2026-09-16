/**
 * Cruce de asistentes de Evently con miembros cuando el email no calza (la
 * gente se inscribe con otro correo). Regla conservadora: se enlaza por nombre
 * solo cuando el nombre completo del miembro (2+ palabras) está contenido en
 * UN solo nombre de asistente y ese asistente no calza con ningún otro
 * miembro. «María José» a secas, que aparece en varias inscritas, queda para
 * enlazar a mano desde el ERP.
 */

export interface NameMatchMember {
  id: string;
  full_name: string;
}

/** Sin mayúsculas, tildes ni puntuación; espacios simples. */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Por asistente, el miembro que le calza sin ambigüedad (o nada). */
export function matchByName<A extends { name: string | null }>(
  attendees: A[],
  members: NameMatchMember[]
): Map<A, string> {
  const candidates = members
    .map((m) => ({ id: m.id, tokens: normalizeName(m.full_name).split(" ").filter(Boolean) }))
    .filter((m) => m.tokens.length >= 2);

  const byNorm = new Map<string, A[]>();
  for (const attendee of attendees) {
    const norm = attendee.name ? normalizeName(attendee.name) : "";
    if (!norm) continue;
    byNorm.set(norm, [...(byNorm.get(norm) ?? []), attendee]);
  }

  // miembro → nombres de asistente que lo contienen; asistente → miembros.
  const perMember = new Map<string, Set<string>>();
  const perAttendee = new Map<string, Set<string>>();
  for (const norm of byNorm.keys()) {
    const hay = norm.split(" ");
    for (const m of candidates) {
      if (!m.tokens.every((t) => hay.includes(t))) continue;
      perMember.set(m.id, (perMember.get(m.id) ?? new Set<string>()).add(norm));
      perAttendee.set(norm, (perAttendee.get(norm) ?? new Set<string>()).add(m.id));
    }
  }

  const result = new Map<A, string>();
  for (const [norm, memberIds] of perAttendee) {
    if (memberIds.size !== 1) continue;
    const [memberId] = memberIds;
    if ((perMember.get(memberId)?.size ?? 0) !== 1) continue;
    for (const attendee of byNorm.get(norm) ?? []) result.set(attendee, memberId);
  }
  return result;
}

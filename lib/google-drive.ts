import "server-only";

/**
 * Cliente mínimo de Google Drive para el módulo Documentos.
 *
 * Autenticación: OAuth de la cuenta dueña del Drive (martin.munoz.padilla1),
 * con refresh token permanente. Sin librería de Google: son tres endpoints
 * REST y así no se arrastra una dependencia gigante al bundle del servidor.
 *
 * El access token dura ~1 hora; se cachea en memoria del proceso y se renueva
 * solo cuando está por vencer.
 */

const ROOT_FOLDER = () => process.env.GOOGLE_DRIVE_ROOT_FOLDER ?? "";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number | null;
  modifiedTime: string;
  webViewLink: string;
  iconLink: string | null;
  thumbnailLink: string | null;
  isFolder: boolean;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export function driveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REFRESH_TOKEN &&
    ROOT_FOLDER()
  );
}

async function accessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 120_000) return cachedToken.value;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN!,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`No se pudo renovar el token de Google (${response.status})`);
  const data = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

const FIELDS = "id,name,mimeType,size,modifiedTime,webViewLink,iconLink,thumbnailLink";

function toFile(raw: Record<string, unknown>): DriveFile {
  return {
    id: String(raw.id),
    name: String(raw.name),
    mimeType: String(raw.mimeType),
    size: raw.size ? Number(raw.size) : null,
    modifiedTime: String(raw.modifiedTime ?? ""),
    webViewLink: String(raw.webViewLink ?? ""),
    iconLink: raw.iconLink ? String(raw.iconLink) : null,
    thumbnailLink: raw.thumbnailLink ? String(raw.thumbnailLink) : null,
    isFolder: raw.mimeType === FOLDER_MIME,
  };
}

/** Lista una carpeta (por defecto, la raíz TEAM STRIDE). Carpetas primero. */
export async function listFolder(folderId?: string): Promise<DriveFile[]> {
  const token = await accessToken();
  const id = folderId ?? ROOT_FOLDER();
  const params = new URLSearchParams({
    q: `'${id}' in parents and trashed=false`,
    fields: `files(${FIELDS})`,
    orderBy: "folder,name",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Drive respondió ${response.status}`);
  const data = (await response.json()) as { files: Record<string, unknown>[] };
  return data.files.map(toFile);
}

/** Metadatos de un archivo o carpeta (para migas de pan y validaciones). */
export async function getFile(fileId: string): Promise<DriveFile & { parents: string[] }> {
  const token = await accessToken();
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=${FIELDS},parents&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!response.ok) throw new Error(`Drive respondió ${response.status}`);
  const raw = (await response.json()) as Record<string, unknown>;
  return { ...toFile(raw), parents: (raw.parents as string[]) ?? [] };
}

/**
 * Ruta desde la raíz TEAM STRIDE hasta la carpeta pedida. Si la carpeta no
 * cuelga de la raíz, devuelve null: el módulo no navega fuera del árbol.
 */
export async function breadcrumb(folderId: string): Promise<Array<{ id: string; name: string }> | null> {
  const root = ROOT_FOLDER();
  if (folderId === root) return [];
  const trail: Array<{ id: string; name: string }> = [];
  let current = folderId;
  for (let depth = 0; depth < 12; depth++) {
    const file = await getFile(current);
    trail.unshift({ id: file.id, name: file.name });
    const parent = file.parents[0];
    if (!parent) return null;
    if (parent === root) return trail;
    current = parent;
  }
  return null;
}

/** Sube un archivo a una carpeta del árbol (multipart, hasta ~5 MB por request). */
export async function uploadFile(
  folderId: string,
  name: string,
  mimeType: string,
  bytes: Uint8Array
): Promise<DriveFile> {
  const token = await accessToken();
  const boundary = `stride-${Date.now()}`;
  const metadata = JSON.stringify({ name, parents: [folderId] });
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`;
  const tail = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(head), Buffer.from(bytes), Buffer.from(tail)]);

  const response = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${FIELDS}&supportsAllDrives=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!response.ok) throw new Error(`Drive rechazó la subida (${response.status})`);
  return toFile((await response.json()) as Record<string, unknown>);
}

/** Crea una subcarpeta. */
export async function createFolder(parentId: string, name: string): Promise<DriveFile> {
  const token = await accessToken();
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?fields=${FIELDS}&supportsAllDrives=true`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!response.ok) throw new Error(`Drive respondió ${response.status}`);
  return toFile((await response.json()) as Record<string, unknown>);
}

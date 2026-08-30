"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { uploadMemberPhoto } from "@/app/miembros/actions";

export function PhotoUploader() {
  const input = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function selected(file?: File) {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    const data = new FormData();
    data.set("photo", file);
    const result = await uploadMemberPhoto(data);
    setLoading(false);
    setMessage(result.ok ? "Foto actualizada." : result.error ?? "No se pudo actualizar.");
  }

  return (
    <div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void selected(event.target.files?.[0])} />
      <button type="button" disabled={loading} onClick={() => input.current?.click()} className="btn-secondary px-4 py-2 text-sm">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Cambiar foto
      </button>
      {message && <p className="mt-2 text-xs text-white/45">{message}</p>}
    </div>
  );
}

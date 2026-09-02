"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Camera, Loader2, UserRound } from "lucide-react";
import { uploadTeamPhoto } from "@/app/admin/equipo/actions";
import { compressAvatar } from "@/lib/image-client";

/** Foto de perfil propia: aparece en el menú lateral y en el equipo. */
export function MyPhotoUploader({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      // Se comprime en el navegador: una foto de celular de 5 MB pasa a ~100 KB.
      form.set("photo", await compressAvatar(file));
      const result = await uploadTeamPhoto(form);
      if (!result.ok) setError(result.error ?? "No se pudo subir.");
    });
  }

  return (
    <div className="card flex items-center gap-4 p-6">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5"
        title="Cambiar foto"
      >
        {photoUrl ? (
          <Image src={photoUrl} alt={name} fill unoptimized className="object-cover" />
        ) : (
          <UserRound className="absolute inset-0 m-auto h-6 w-6 text-white/35" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100">
          {pending ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Camera className="h-4 w-4 text-white" />}
        </span>
      </button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <div>
        <p className="font-heading font-bold text-white">Tu foto de perfil</p>
        <p className="mt-1 text-sm text-white/45">Se ve en el menú lateral y en la lista del equipo.</p>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      </div>
    </div>
  );
}

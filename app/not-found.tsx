import Link from "next/link";

/** 404 del sitio: sin jerga, con salida a la portada y al área de miembros. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/35">404</p>
      <h1 className="mt-3 font-heading text-2xl font-extrabold">Esa página no existe</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
        Puede que el link esté incompleto o que la página haya cambiado de lugar.
      </p>
      <div className="mt-6 flex gap-2.5">
        <Link href="/" className="rounded-full bg-stride-accent px-6 py-2.5 font-heading text-sm font-bold text-white">Ir a la portada</Link>
        <Link href="/miembros" className="rounded-full border border-white/15 px-6 py-2.5 font-heading text-sm font-semibold text-white/70">Área de miembros</Link>
      </div>
    </main>
  );
}

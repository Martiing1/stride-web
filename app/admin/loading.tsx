/**
 * Esqueleto instantáneo entre módulos del ERP: aparece apenas se navega,
 * mientras el servidor arma la página real.
 */
export default function AdminLoading() {
  return (
    <div className="animate-pulse space-y-8">
      <div>
        <div className="h-8 w-56 rounded-lg bg-white/5" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-white/5" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-white/[0.03]" />
        ))}
      </div>
    </div>
  );
}

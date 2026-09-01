/** Skeleton de carga del área de miembros: la navegación se siente inmediata. */
export default function MemberLoading() {
  return (
    <div className="m-pagein space-y-4">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-[var(--sline)] bg-[var(--scard)] p-5"
          style={{ animationDelay: `${index * 120}ms` }}
        >
          <div className="h-4 w-1/3 rounded-full bg-[var(--shover)]" />
          <div className="mt-3 h-3 w-2/3 rounded-full bg-[var(--shover)]" />
          <div className="mt-2 h-3 w-1/2 rounded-full bg-[var(--shover)]" />
        </div>
      ))}
    </div>
  );
}

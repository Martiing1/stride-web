/** Transición de entrada entre pestañas (se re-monta en cada navegación). */
export default function MemberTemplate({ children }: { children: React.ReactNode }) {
  return <div className="m-pagein">{children}</div>;
}

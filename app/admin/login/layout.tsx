/**
 * El login necesita su propio layout porque el de /admin exige sesión: sin
 * esto, entrar a iniciar sesión redirigiría al propio login en loop.
 */
export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

import { redirect } from "next/navigation";
import { MemberLoginForm } from "@/components/member/MemberLoginForm";
import { StrideLogo } from "@/components/StrideLogo";
import { getCurrentMember } from "@/lib/member-auth";

export const dynamic = "force-dynamic";

/** Motivos por los que un enlace de acceso puede rebotar hasta acá. */
const LOGIN_ERRORS: Record<string, string> = {
  vencido:
    "Ese enlace ya se usó o venció. Pide un código nuevo: los enlaces sirven una sola vez.",
  "otro-navegador":
    "Abriste el enlace en un navegador distinto al que pidió el acceso. Escribe abajo el código del correo, o pide uno nuevo desde este mismo dispositivo.",
  enlace: "No pudimos validar ese enlace. Pide un código nuevo e inténtalo otra vez.",
};

export default async function MemberLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const member = await getCurrentMember();
  if (member) redirect("/miembros");

  const { error } = await searchParams;
  const errorMessage = error ? LOGIN_ERRORS[error] ?? LOGIN_ERRORS.enlace : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-stride-bg px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><StrideLogo large /></div>
        <MemberLoginForm initialError={errorMessage} />
        <p className="mt-6 text-center text-xs leading-relaxed text-white/30">El acceso es personal. Si necesitas ayuda, escríbenos por WhatsApp.</p>
      </div>
    </main>
  );
}

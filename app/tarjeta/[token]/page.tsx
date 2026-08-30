import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mi tarjeta STRIDE ONE",
  // El link es un secreto: no debe terminar indexado en Google.
  robots: { index: false, follow: false, nocache: true },
};

export default function TarjetaPage() {
  redirect("/miembros/ingresar");
}

import { ActivationForm } from "@/components/admin/ActivationForm";

export const metadata = {
  title: "Activar acceso ERP",
  robots: { index: false, follow: false },
};

export default function ActivationPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-stride-bg px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-heading text-3xl font-extrabold tracking-tight text-white">STRIDE</p>
          <p className="mt-1 text-sm text-white/40">Activación del sistema interno</p>
        </div>
        <ActivationForm />
      </div>
    </main>
  );
}

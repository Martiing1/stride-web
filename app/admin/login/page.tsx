import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = {
  title: "Acceso ERP",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-stride-bg px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-heading text-3xl font-extrabold tracking-tight text-white">STRIDE</p>
          <p className="mt-1 text-sm text-white/40">Sistema interno</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

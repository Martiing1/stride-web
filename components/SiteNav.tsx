import Link from "next/link";
import { StrideLogo } from "@/components/StrideLogo";

const LINKS = [
  { href: "/eventos", label: "Social Runs" },
  { href: "/one", label: "STRIDE ONE" },
];

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-stride-bg/85 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" aria-label="Ir al inicio" className="inline-flex items-center">
          <StrideLogo />
        </Link>

        <div className="flex min-w-0 items-center gap-1 sm:gap-4">
          <div className="hidden items-center gap-1 sm:flex sm:gap-4">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-white/70 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <Link
            href="/#sumate"
            className="gradient-surface ml-1 shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold text-white shadow-[0_0_24px_rgba(99,102,241,0.3)] transition hover:brightness-110"
          >
            Quiero sumarme
          </Link>
        </div>
      </nav>
    </header>
  );
}

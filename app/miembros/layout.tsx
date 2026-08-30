import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi carnet STRIDE ONE",
  robots: { index: false, follow: false, nocache: true },
};

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://stridechile.cl"),
  title: {
    default: "STRIDE — Comunidad de running en Concepción",
    template: "%s · STRIDE",
  },
  description:
    "STRIDE no vende running. Vende comunidad, experiencia e identidad. Social Runs gratuitos en Concepción y la membresía STRIDE ONE.",
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "STRIDE",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}

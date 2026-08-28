import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://stridechile.cl"),
  title: {
    default: "STRIDE — Correr es la excusa para socializar",
    template: "%s · STRIDE",
  },
  description:
    "Social Runs gratuitos en Concepción para correr, conocer gente y construir una comunidad que te ayude a volver cada semana.",
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "STRIDE",
    url: "/",
    title: "STRIDE — Correr es la excusa para socializar",
    description:
      "Social Runs gratuitos en Concepción. Sin nivel mínimo y sin tener que conocer a nadie para llegar.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "STRIDE — Correr es la excusa para socializar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "STRIDE — Correr es la excusa para socializar",
    description: "Social Runs gratuitos en Concepción.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}

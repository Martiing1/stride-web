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
    "Una comunidad que se mueve, se encuentra y vuelve cada semana. Correr es la excusa para socializar.",
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "STRIDE",
    url: "/",
    title: "STRIDE — Correr es la excusa para socializar",
    description: "Una comunidad que se mueve, se encuentra y vuelve cada semana.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "STRIDE — Correr es la excusa para socializar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "STRIDE — Correr es la excusa para socializar",
    description: "Una comunidad que se mueve, se encuentra y vuelve cada semana.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CL" className={`${inter.variable} ${outfit.variable}`}>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}

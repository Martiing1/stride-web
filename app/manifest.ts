import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/miembros/perfil",
    name: "STRIDE ONE — Mi carnet",
    short_name: "STRIDE ONE",
    description: "Carnet digital y beneficios de la comunidad STRIDE ONE.",
    // Abre directo en el Perfil: ahí vive el carnet con el QR (pedido de Martín).
    start_url: "/miembros/perfil",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/miembros",
    name: "STRIDE ONE — Mi carnet",
    short_name: "STRIDE ONE",
    description: "Carnet digital y beneficios de la comunidad STRIDE ONE.",
    start_url: "/miembros",
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

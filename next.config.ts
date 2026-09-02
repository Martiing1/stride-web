import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    serverActions: {
      // Las fotos (perfil, evidencias, medallas) viajan por Server Actions.
      // El límite por defecto es 1 MB: cualquier foto de celular lo supera y
      // Next corta la petición con una excepción antes de entrar a la acción,
      // que es lo que mostraba "Application error" al subir la foto de perfil.
      // Los topes reales por tipo de archivo los valida cada acción.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

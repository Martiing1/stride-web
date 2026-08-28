/**
 * Datos de contacto y links externos. Centralizados acá para que cambiar el
 * WhatsApp o Instagram sea un solo edit y no una cacería por el código.
 */
export const SITE = {
  name: "STRIDE",
  city: "Concepción",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://stridechile.cl",

  // TODO: reemplazar por los datos reales antes de publicar.
  whatsapp: "56934806986",
  whatsappLabel: "+56 9 3480 6986",
  instagram: "https://instagram.com/stridechile",

  membership: {
    name: "STRIDE ONE",
    priceCLP: 31990,
    priceLabel: "$31.990",
  },

  /**
   * Foto de fondo del hero. Debe ser una imagen real de un Social Run:
   * horizontal, gente corriendo en grupo, mejor si se reconoce Concepción.
   * Va en /public/hero.jpg. Si no existe, el hero cae a un fondo degradado.
   */
  heroImage: "/hero.jpg",

  /** Números que se muestran en el hero. Actualizar cuando cambien. */
  stats: {
    members: "+2.000",
    events: "+100",
    years: "2 años",
  },
} as const;

export function whatsappLink(message: string): string {
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}

export function formatCLP(amount: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(amount);
}

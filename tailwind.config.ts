import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stride: {
          bg: "#0A0A0A",
          bg2: "#121212",
          card: "#1E1E2E",
          // Morado sólido para botones y CTAs: los extremos del degradado de
          // marca no dan contraste suficiente con texto blanco.
          accent: "#7C3AED",
          accentDark: "#6B21A8",
          amber: "#F59E0B",
          // Degradado de marca, tomado del logo oficial (stride_logo.png).
          // El logo va de cian a magenta; el degradado de la web se corta en
          // `accent` para bajarle al rosado, pasando por indigo.
          cyan: "#00E5FF",
          indigo: "#6366F1",
          magenta: "#FF00FF",
        },
      },
      fontFamily: {
        heading: ["var(--font-outfit)", "Inter", "sans-serif"],
        body: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      keyframes: {
        // Recorre la mitad del contenido: la lista va duplicada, así que al
        // completar el ciclo el segundo juego queda donde partió el primero.
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        marquee: "marquee 45s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

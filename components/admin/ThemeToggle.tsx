"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const KEY = "stride-admin-theme";

/**
 * Tema claro / oscuro del ERP. Se guarda por navegador; el layout inyecta un
 * script que aplica el atributo antes de pintar para que no parpadee.
 */
export function ThemeToggle({ expanded }: { expanded: boolean }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.dataset.adminTheme === "light");
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    if (next) document.documentElement.dataset.adminTheme = "light";
    else delete document.documentElement.dataset.adminTheme;
    try { localStorage.setItem(KEY, next ? "light" : "dark"); } catch { /* sin storage */ }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={light ? "Cambiar a tema oscuro" : "Cambiar a tema claro"}
      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-white/60 transition hover:bg-white/5 hover:text-white"
    >
      {light ? <Moon className="h-4 w-4 shrink-0" /> : <Sun className="h-4 w-4 shrink-0" />}
      <span className={`whitespace-nowrap transition-opacity duration-150 ${expanded ? "opacity-100" : "opacity-0"}`}>
        {light ? "Tema oscuro" : "Tema claro"}
      </span>
    </button>
  );
}

/** Script inline para aplicar el tema guardado antes del primer pintado. */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem("${KEY}")==="light")document.documentElement.dataset.adminTheme="light"}catch(e){}`;

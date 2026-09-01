"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import clsx from "clsx";

/** Cambia el área de miembros entre tema oscuro y claro (persiste en el navegador). */
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    try {
      if (localStorage.getItem("stride_mtheme") === "light") setTheme("light");
    } catch {}
  }, []);

  const apply = (next: "dark" | "light") => {
    setTheme(next);
    try {
      localStorage.setItem("stride_mtheme", next);
    } catch {}
    const shell = document.getElementById("mshell");
    if (next === "light") shell?.setAttribute("data-mtheme", "light");
    else shell?.removeAttribute("data-mtheme");
  };

  return (
    <div className="flex rounded-full border border-[var(--sline)] bg-[var(--scard2)] p-1">
      {(
        [
          { value: "dark", label: "Oscuro", Icon: Moon },
          { value: "light", label: "Claro", Icon: Sun },
        ] as const
      ).map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => apply(value)}
          className={clsx(
            "flex items-center gap-2 rounded-full px-4 py-2 font-heading text-sm font-semibold transition",
            theme === value ? "bg-stride-accent text-white" : "text-[var(--smut)] hover:text-[var(--stext)]"
          )}
        >
          <Icon className="h-4 w-4" /> {label}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    // El ERP (admin.) no es la PWA: ahí el middleware reescribe /sw.js y el
    // registro fallaba con un 404 en la consola de cada página.
    if (window.location.hostname.startsWith("admin.")) return;
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);
  return null;
}

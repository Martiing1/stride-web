self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// El carnet, su estado y el QR nunca se guardan offline. El service worker
// existe para la instalación PWA y deja todas las peticiones en la red.
self.addEventListener("fetch", () => {});

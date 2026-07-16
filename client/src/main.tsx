import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ── Service-worker lifecycle ──────────────────────────────────────────────────
// In dev: aggressively unregister any stale SW so it never intercepts the
// Replit proxy and causes a blank page.
// In prod: register the Workbox-generated SW and auto-update it.
if ("serviceWorker" in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              if (nw.state === "installed" && navigator.serviceWorker.controller) {
                nw.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch((err) => console.error("SW registration failed:", err));
    });
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

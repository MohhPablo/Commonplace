import { registerAppUpdates } from "./lib/updates";
import { installViewportTracking } from "./lib/viewport";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { requestPersistentStorage } from "./lib/db";

// Best-effort persistent storage request (spec §6 / technical ref §3).
requestPersistentStorage();
installViewportTracking();
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void registerAppUpdates(navigator.serviceWorker);
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Fade out the pre-JS boot splash once React has painted, then remove it.
const splash = document.getElementById("boot-splash");
if (splash) {
  splash.classList.add("boot-splash--hide");
  setTimeout(() => splash.remove(), 420);
}

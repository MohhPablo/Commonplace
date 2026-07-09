import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { requestPersistentStorage } from "./lib/db";

// Best-effort persistent storage request (spec §6 / technical ref §3).
requestPersistentStorage();

// Block pinch / double-tap zoom on iOS so the app feels native. iOS 10+
// can ignore viewport user-scalable, so also cancel the gesture events.
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("gesturechange", (e) => e.preventDefault());
document.addEventListener("gestureend", (e) => e.preventDefault());
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (e) => {
    const now = Date.now();
    if (now - lastTouchEnd < 300) e.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false },
);

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

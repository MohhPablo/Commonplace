import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
import { requestPersistentStorage } from "./lib/db";

// Best-effort persistent storage request (spec §6 / technical ref §3).
requestPersistentStorage();

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

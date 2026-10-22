import { createContext } from "react";

/** Background privacy locks must also hide portals and release modal inertness. */
export const ModalAvailability = createContext(true);

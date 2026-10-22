import { createContext } from "react";
export const WritingMode = createContext<(writing: boolean) => void>(() => {});

"use client";

import { createContext, useContext } from "react";

export const PanelFullscreenContext = createContext<boolean>(false);

export function useInFullscreenPanel(): boolean {
  return useContext(PanelFullscreenContext);
}

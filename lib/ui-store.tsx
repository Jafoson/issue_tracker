"use client";

import { createContext, useCallback, useContext, useEffect, useReducer } from "react";
import type { Locale, Toast } from "@/types";

interface UIState {
  locale: Locale;
  toast: Toast | null;
}

type UIAction =
  | { type: "SET_LOCALE"; locale: Locale }
  | { type: "TOAST"; toast: Omit<Toast, "id"> | null };

function reducer(state: UIState, a: UIAction): UIState {
  switch (a.type) {
    case "SET_LOCALE":
      if (typeof window !== "undefined") localStorage.setItem("orbit-locale", a.locale);
      return { ...state, locale: a.locale };
    case "TOAST":
      return { ...state, toast: a.toast ? { id: Date.now(), ...a.toast } : null };
    default:
      return state;
  }
}

interface UIValue {
  ui: UIState;
  dispatch: React.Dispatch<UIAction>;
  toast: (msg: string) => void;
}

const Ctx = createContext<UIValue | null>(null);

export function useUI() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}

export function UIProvider({ children, locale: init }: { children: React.ReactNode; locale: Locale }) {
  const [ui, dispatch] = useReducer(reducer, { locale: init, toast: null });

  useEffect(() => {
    if (!ui.toast) return;
    const t = setTimeout(() => dispatch({ type: "TOAST", toast: null }), 2600);
    return () => clearTimeout(t);
  }, [ui.toast]);

  const toast = useCallback((msg: string) => dispatch({ type: "TOAST", toast: { msg } }), []);

  return <Ctx.Provider value={{ ui, dispatch, toast }}>{children}</Ctx.Provider>;
}

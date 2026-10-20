"use client";

import { useEffect, useState } from "react";

const eventName = "finance-appearance-change";
export function useAppearance() {
  const [dark, setDark] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const sync = () => {
      try {
        setDark(localStorage.getItem("finance-theme") === "dark");
        setPaused(localStorage.getItem("finance-motion") === "paused");
      } catch { /* Preferences are optional when storage is unavailable. */ }
    };
    sync();
    window.addEventListener(eventName, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(eventName, sync); window.removeEventListener("storage", sync); };
  }, []);
  function setTheme(value: boolean) {
    setDark(value);
    try { localStorage.setItem("finance-theme", value ? "dark" : "light"); } catch { /* Storage is optional. */ }
    window.dispatchEvent(new Event(eventName));
  }
  function setMotion(value: boolean) {
    setPaused(value);
    try { localStorage.setItem("finance-motion", value ? "paused" : "running"); } catch { /* Storage is optional. */ }
    window.dispatchEvent(new Event(eventName));
  }
  return { dark, paused, setTheme, setMotion };
}

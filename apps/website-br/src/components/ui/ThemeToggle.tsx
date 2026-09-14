"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "theme";

type Theme = "light" | "dark";

function setTheme(theme: Theme) {
  if (typeof window === "undefined") return;
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.classList.toggle("light", theme === "light");
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setThemeState(next);
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className="rounded-full p-2 text-slate-700/80 hover:text-slate-900 hover:bg-slate-100 transition"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

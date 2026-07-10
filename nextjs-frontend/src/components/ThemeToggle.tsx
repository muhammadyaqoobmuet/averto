"use client";

import { useEffect, useState } from "react";
import {
  useModeAnimation,
  ThemeAnimationType,
} from "react-theme-switch-animation";
import { useSound } from "@/hooks/use-sound";
import { click002Sound } from "@/lib/click-002";

function SunIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="8"
        y1="1"
        x2="8"
        y2="2.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="8"
        y1="13.2"
        x2="8"
        y2="15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="1"
        y1="8"
        x2="2.8"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="13.2"
        y1="8"
        x2="15"
        y2="8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="3.2"
        y1="3.2"
        x2="4.4"
        y2="4.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="11.6"
        y1="11.6"
        x2="12.8"
        y2="12.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="12.8"
        y1="3.2"
        x2="11.6"
        y2="4.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="4.4"
        y1="11.6"
        x2="3.2"
        y2="12.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);

  // Polygon diagonal wipe — expo-out easing is the library's default for POLYGON
  const { ref, toggleSwitchTheme, isDarkMode } = useModeAnimation({
    animationType: ThemeAnimationType.POLYGON,
    duration: 750,
  });

  // Keep our data-theme attribute in sync with the library's isDarkMode state.
  // The library manages its own `dark` class on <html>; we also need data-theme
  // for our CSS variable system.
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light",
    );
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  // Prevent hydration mismatch — render a same-size placeholder on the server
  useEffect(() => {
    setMounted(true);
  }, []);

  const [playClick] = useSound(click002Sound);

  if (!mounted) {
    return (
      <div
        className={`w-9 h-9 rounded-lg border border-[var(--border)] ${className}`}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      ref={ref}
      onClick={() => { playClick(); toggleSwitchTheme(); }}
      aria-label={`Switch to ${isDarkMode ? "light" : "dark"} theme`}
      className={`w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-all duration-200 cursor-pointer ${className}`}
    >
      {isDarkMode ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

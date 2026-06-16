"use client";

import { ToastProvider } from "./Toaster";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

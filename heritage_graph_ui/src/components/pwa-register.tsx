"use client";

import { useEffect } from "react";

/**
 * Registers `/public/sw.js` in production builds only.
 * Pair with `public/manifest.json` and `metadata.manifest` on the root layout.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

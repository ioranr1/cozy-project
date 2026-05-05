import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const PREVIEW_CLEANUP_RELOAD_KEY = "aiguard_preview_sw_cleanup_reloaded";

const isLovablePreview =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com") ||
    window.location.hostname.includes("lovable.dev"));

const isFramed = (() => {
  if (typeof window === "undefined") return false;

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

if (typeof window !== "undefined" && (isLovablePreview || isFramed)) {
  const hadServiceWorkerController = Boolean(navigator.serviceWorker?.controller);

  void navigator.serviceWorker?.getRegistrations().then(async (registrations) => {
    await Promise.all(registrations.map((registration) => registration.unregister()));

    if (hadServiceWorkerController && sessionStorage.getItem(PREVIEW_CLEANUP_RELOAD_KEY) !== "1") {
      sessionStorage.setItem(PREVIEW_CLEANUP_RELOAD_KEY, "1");
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("sw-cleanup", Date.now().toString());
      window.location.replace(nextUrl.toString());
    }
  });

  if ("caches" in window) {
    void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
  }
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(<App />);
} else {
  console.error('[AIGuard] Root element was not found.');
}

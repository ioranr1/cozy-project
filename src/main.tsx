import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const isLovablePreview =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
    window.location.hostname.includes("lovableproject.com"));

const isFramed = (() => {
  if (typeof window === "undefined") return false;

  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

if (typeof window !== "undefined" && (isLovablePreview || isFramed)) {
  void navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      void registration.unregister();
    });
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

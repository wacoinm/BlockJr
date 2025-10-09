// src/components/Container.tsx
import React, { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";

type Props = { children: React.ReactNode };

/**
 * Container
 * - Registers Android back button handling via Capacitor App plugin.
 * - If there is navigation history -> go back (window.history.back()).
 * - Otherwise -> double-press-to-exit (press back twice within 2s to exit).
 *
 * This component returns children and can wrap RouterProvider in main.tsx.
 */
const Container: React.FC<Props> = ({ children }) => {
  const lastBackPress = useRef(0);
  useEffect(() => {
    // Guard: only run on Android native builds
    const platform = Capacitor?.getPlatform ? Capacitor.getPlatform() : undefined;
    if (platform !== "android") return;

    let listenerHandle: any = null;

    App.addListener("backButton", (data?: any) => {
      // Prefer data.canGoBack if provided by Capacitor; otherwise fallback to history length
      const canGoBack =
        data && typeof data.canGoBack === "boolean" ? data.canGoBack : window.history.length > 1;

      if (canGoBack) {
        // navigate back in SPA
        window.history.back();
        return;
      }

      // No history -> double-press to exit behavior
      const now = Date.now();
      if (now - lastBackPress.current < 2000) {
        // second press within 2s -> exit
        App.exitApp();
      } else {
        lastBackPress.current = now;
        // Show a user-visible hint. Replace with your toast if available.
        // Example: call your ToastContain's API here if you have a global toast function.
        console.log("Press back again to exit");
      }
    })
      .then((handle) => {
        listenerHandle = handle;
      })
      .catch((err) => {
        console.warn("Failed to add backButton listener (web/dev?):", err);
      });

    return () => {
      // cleanup
      if (listenerHandle && typeof listenerHandle.remove === "function") {
        listenerHandle.remove();
      }
    };
  }, []);

  return <>{children}</>;
};

export default Container;

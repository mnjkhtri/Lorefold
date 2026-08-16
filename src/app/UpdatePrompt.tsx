import { useEffect, useRef, useState } from "react";

export function UpdatePrompt() {
  const [offlineReady, setOfflineReady] = useState(false);
  const [needRefresh, setNeedRefresh] = useState(false);
  const refreshing = useRef(false);

  useEffect(() => {
    if (import.meta.env.DEV || !("serviceWorker" in navigator)) return undefined;

    let registration: ServiceWorkerRegistration | undefined;
    const register = async () => {
      registration = await navigator.serviceWorker.register(
        `${import.meta.env.BASE_URL}sw.js`,
        { scope: import.meta.env.BASE_URL },
      );
      if (registration.waiting) setNeedRefresh(true);

      registration.addEventListener("updatefound", () => {
        const worker = registration?.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state !== "installed") return;
          if (navigator.serviceWorker.controller) setNeedRefresh(true);
          else setOfflineReady(true);
        });
      });
    };

    void register().catch(() => undefined);
    const onControllerChange = () => {
      if (!refreshing.current) return;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);

  if (!offlineReady && !needRefresh) return null;
  return (
    <aside className="update-prompt" role="status">
      {offlineReady && <span>Offline shell ready.</span>}
      {needRefresh && (
        <>
          <span>New version available.</span>
          <button
            type="button"
            onClick={() => {
              refreshing.current = true;
              void navigator.serviceWorker.getRegistration().then((registration) => {
                registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
              });
            }}
          >
            Update
          </button>
        </>
      )}
      <button type="button" onClick={() => { setOfflineReady(false); setNeedRefresh(false); }}>
        Dismiss
      </button>
    </aside>
  );
}

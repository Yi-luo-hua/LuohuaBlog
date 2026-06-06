export function getServiceWorkerUrl() {
  return "/sw.js";
}

function isLocalhost(hostname = "") {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function shouldRegisterServiceWorker({
  isProduction,
  navigatorRef,
  windowRef,
} = {}) {
  if (!isProduction) return false;
  if (!navigatorRef || !("serviceWorker" in navigatorRef)) return false;

  const location = windowRef?.location;
  if (!location) return false;

  return location.protocol === "https:" || isLocalhost(location.hostname);
}

export function registerServiceWorker({
  isProduction = import.meta.env.PROD,
  navigatorRef = globalThis.navigator,
  windowRef = globalThis.window,
} = {}) {
  if (
    !shouldRegisterServiceWorker({
      isProduction,
      navigatorRef,
      windowRef,
    })
  ) {
    return;
  }

  windowRef.addEventListener("load", () => {
    navigatorRef.serviceWorker.register(getServiceWorkerUrl()).catch(() => {});
  });
}

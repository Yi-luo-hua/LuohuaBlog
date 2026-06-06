import test from "node:test";
import assert from "node:assert/strict";

import {
  getServiceWorkerUrl,
  shouldRegisterServiceWorker,
} from "./registerServiceWorker.js";

test("does not register outside production builds", () => {
  assert.equal(
    shouldRegisterServiceWorker({
      isProduction: false,
      navigatorRef: { serviceWorker: {} },
      windowRef: { location: { protocol: "https:" } },
    }),
    false,
  );
});

test("registers only when service workers are available on a safe protocol", () => {
  assert.equal(
    shouldRegisterServiceWorker({
      isProduction: true,
      navigatorRef: { serviceWorker: {} },
      windowRef: { location: { protocol: "https:" } },
    }),
    true,
  );

  assert.equal(
    shouldRegisterServiceWorker({
      isProduction: true,
      navigatorRef: {},
      windowRef: { location: { protocol: "https:" } },
    }),
    false,
  );
});

test("allows localhost registration for preview builds", () => {
  assert.equal(
    shouldRegisterServiceWorker({
      isProduction: true,
      navigatorRef: { serviceWorker: {} },
      windowRef: {
        location: { protocol: "http:", hostname: "localhost" },
      },
    }),
    true,
  );
});

test("uses the root service worker URL", () => {
  assert.equal(getServiceWorkerUrl(), "/sw.js");
});

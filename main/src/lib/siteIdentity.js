/**
 * The one place this site's own addresses are defined.
 *
 * The site is served from a bare Azure IP until a domain is registered, and an
 * IP host cannot hold a public certificate — so the scheme has to follow the
 * host rather than being assumed to be https. Bare IPv4 and localhost get
 * http, real domain names get https. A production build therefore only has to
 * set VITE_SITE_HOST and every absolute URL it generates is already correct,
 * with nothing left to patch afterwards in the built files.
 *
 *   VITE_SITE_HOST=yourdomain.com
 *   VITE_SITE_APP_HOST=app.yourdomain.com
 *   VITE_SITE_PROTOCOL=https   # only to override the guess above
 */
const env = import.meta.env ?? {};

/** Public host the site is served from. */
export const SITE_HOST = env.VITE_SITE_HOST || "example.com";

/** Host that gates the owner-only PWA console. */
export const SITE_APP_HOST = env.VITE_SITE_APP_HOST || `app.${SITE_HOST}`;

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Hosts that can never present a public certificate. */
const cannotHoldCertificate = (host) =>
  IPV4.test(host) ||
  host === "localhost" ||
  host === "127.0.0.1" ||
  host.endsWith(".local");

/** `http` or `https`, following the host unless VITE_SITE_PROTOCOL overrides. */
export const SITE_PROTOCOL =
  String(env.VITE_SITE_PROTOCOL || "").replace(/:$/, "") ||
  (cannotHoldCertificate(SITE_HOST) ? "http" : "https");

/** Absolute origin, e.g. `https://example.com`. */
export const SITE_ORIGIN = `${SITE_PROTOCOL}://${SITE_HOST}`;

/** True while the placeholder domain is still in use. */
export const SITE_HOST_IS_PLACEHOLDER = !env.VITE_SITE_HOST;

/** Builds an absolute URL on this site, e.g. siteUrl("/blog/") . */
export const siteUrl = (path = "/") =>
  `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;

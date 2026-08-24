/**
 * The one place this site's own addresses are defined.
 *
 * No domain is registered yet, so the defaults below are placeholders on
 * example.com — a name RFC 2606 reserves for documentation, so it can never
 * accidentally resolve to somebody else's site the way a real-looking guess
 * would. Override them at build time:
 *
 *   VITE_SITE_HOST=yourdomain.com
 *   VITE_SITE_APP_HOST=app.yourdomain.com
 *
 * or edit the two fallbacks here once the domain exists.
 */
const env = import.meta.env ?? {};

/** Public host the site is served from. */
export const SITE_HOST = env.VITE_SITE_HOST || "example.com";

/** Host that gates the owner-only PWA console. */
export const SITE_APP_HOST = env.VITE_SITE_APP_HOST || `app.${SITE_HOST}`;

/** Absolute origin, e.g. `https://example.com`. */
export const SITE_ORIGIN = `https://${SITE_HOST}`;

/** True while the placeholder domain is still in use. */
export const SITE_HOST_IS_PLACEHOLDER = !env.VITE_SITE_HOST;

/** Builds an absolute URL on this site, e.g. siteUrl("/blog/") . */
export const siteUrl = (path = "/") =>
  `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;

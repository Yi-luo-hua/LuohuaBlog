const DIRECT_COS_ORIGIN =
  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/";

const SITE_THUMBNAIL_REPLACEMENTS = {
  "/cos/about-page/20260624/sites-taozhiyy-3616e0f19f.jpg": "/img/about-sites/taozhiyy.svg",
  "/cos/about-page/20260624/sites-butterfly-3b2fb61396.jpg": "/img/about-sites/butterfly.svg",
  "/cos/about-page/20260624/sites-reimu-a3d1934027.jpg": "/img/about-sites/reimu.svg",
  "/cos/about-page/20260624/sites-tzyy11-41ead66835.jpg": "/img/about-sites/tzyy11.svg",
};

export const rewriteAboutPreviewAssets = (markup = "") =>
  Object.entries(SITE_THUMBNAIL_REPLACEMENTS)
    .reduce(
      (next, [from, to]) => next.replaceAll(from, to),
      String(markup).replaceAll(DIRECT_COS_ORIGIN, "/cos/"),
    )
    .replace(/<img\b[^>]*>/gi, (tag) => {
      let next = tag;
      // Strip inline onerror handlers. Inside a shadow DOM an onerror
      // can fire on transient network hiccups and permanently hide the
      // image (display:none), making it look broken even though a retry
      // would succeed. Letting the broken-image placeholder show is
      // better than silently hiding it.
      next = next.replace(/\sonerror\s*=\s*"[^"]*"/gi, "");
      // Add referrerpolicy to avoid hotlink protection on COS assets.
      if (!/\sreferrerpolicy\s*=/i.test(next)) {
        next = next.replace(/<img\b/i, '<img referrerpolicy="no-referrer"');
      }
      if (!/\sdecoding\s*=/i.test(next)) {
        next = next.replace(/<img\b/i, '<img decoding="async"');
      }
      // All about-preview images are injected into a shadow DOM via
      // innerHTML. Browsers cannot reliably lazy-load <img> elements
      // inside shadow roots created this way - the IntersectionObserver
      // root may never see them, so they stay unloaded forever. The whole
      // page is only ~56 small SVG/JPG assets, so eager loading is cheap
      // and reliable.
      if (!/\sloading\s*=/i.test(next)) {
        next = next.replace(/<img\b/i, '<img loading="eager"');
      } else {
        next = next.replace(/\sloading\s*=\s*"[^"]*"/i, ' loading="eager"');
      }
      return next;
    });

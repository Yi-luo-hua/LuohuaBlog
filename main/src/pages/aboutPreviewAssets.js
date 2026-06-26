const DIRECT_COS_ORIGIN =
  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/";

export const rewriteAboutPreviewAssets = (markup = "") =>
  String(markup)
    .replaceAll(DIRECT_COS_ORIGIN, "/cos/")
    .replace(/<img\b[^>]*>/gi, (tag) => {
      let next = tag;
      if (!/\sdecoding\s*=/i.test(next)) {
        next = next.replace(/<img\b/i, '<img decoding="async"');
      }
      // All about-preview images are injected into a shadow DOM via
      // innerHTML. Browsers cannot reliably lazy-load <img> elements
      // inside shadow roots created this way — the IntersectionObserver
      // root may never see them, so they stay unloaded forever. The whole
      // page is only ~56 small SVG/JPG assets, so eager loading is cheap
      // and reliable. (Previously only .ti marquee icons were forced eager,
      // but project covers, site thumbs, and game cards failed the same way.)
      if (!/\sloading\s*=/i.test(next)) {
        next = next.replace(/<img\b/i, '<img loading="eager"');
      } else {
        next = next.replace(/\sloading\s*=\s*"[^"]*"/i, ' loading="eager"');
      }
      return next;
    });


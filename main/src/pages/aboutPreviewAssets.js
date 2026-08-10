const DIRECT_COS_ORIGIN =
  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/";

const ABOUT_DEFERRED_IMAGE_PLACEHOLDER =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const ABOUT_SECTION_RE =
  /<section\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bsection\b)[^>]*>[\s\S]*?(?=<section\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bsection\b)|<\/main>|$)/gi;
const SRC_ATTRIBUTE_RE = /\ssrc\s*=\s*(["'])(.*?)\1/i;

const escapeAttribute = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

const deferImageTag = (tag) => {
  if (/\sdata-about-deferred-src\s*=/i.test(tag)) return tag;

  const srcMatch = tag.match(SRC_ATTRIBUTE_RE);
  const src = srcMatch?.[2];
  if (!src || /^data:/i.test(src)) return tag;

  return tag.replace(
    SRC_ATTRIBUTE_RE,
    ` src="${ABOUT_DEFERRED_IMAGE_PLACEHOLDER}" data-about-deferred-src="${escapeAttribute(
      src,
    )}" data-about-deferred-img="true"`,
  );
};

export const deferAboutPreviewImagesBySection = (
  markup = "",
  { eagerSectionCount = 2 } = {},
) => {
  let sectionIndex = 0;

  return String(markup).replace(ABOUT_SECTION_RE, (section) => {
    sectionIndex += 1;
    if (sectionIndex <= eagerSectionCount) return section;

    const deferredSection = section.replace(/<img\b[^>]*>/gi, deferImageTag);
    if (deferredSection === section) return section;

    return deferredSection.replace(
      /<section\b/i,
      '<section data-about-deferred-section="true"',
    );
  });
};

export const rewriteAboutPreviewAssets = (markup = "") =>
  String(markup)
    .replaceAll(DIRECT_COS_ORIGIN, "/cos/")
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

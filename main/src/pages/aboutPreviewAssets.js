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
      if (!/\sloading\s*=/i.test(next)) {
        next = next.replace(/<img\b/i, '<img loading="lazy"');
      }
      return next;
    });

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
      const isMarqueeIcon = /\bclass\s*=\s*"[^"]*\bti\b/i.test(next);
      if (!/\sloading\s*=/i.test(next)) {
        next = next.replace(/<img\b/i, isMarqueeIcon ? '<img loading="eager"' : '<img loading="lazy"');
      } else if (isMarqueeIcon) {
        next = next.replace(/\sloading\s*=\s*"[^"]*"/i, ' loading="eager"');
      }
      return next;
    });

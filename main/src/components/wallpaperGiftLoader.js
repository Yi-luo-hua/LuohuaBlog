export const wallpaperUnavailableGift = {
  url: "",
  previewUrl: "",
  album: "外部图片接口未配置",
  label: "外部图片接口暂无可用图片",
  sourceUrl: "https://taozhiyy.top/api/v1/wallpapers/draw?source=api",
  licenseNote: "外部图片接口暂无可用图片，可以稍后再试一次。",
};

const getFallbackWallpaper = (pickFallback) =>
  typeof pickFallback === "function" ? pickFallback() : wallpaperUnavailableGift;

export async function loadWallpaperGift({
  apiOnly = false,
  requestWallpaper,
  pickFallback,
  timeoutMs = 8000,
} = {}) {
  if (typeof requestWallpaper !== "function") {
    return apiOnly ? wallpaperUnavailableGift : getFallbackWallpaper(pickFallback);
  }

  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort();
      reject(new Error("WALLPAPER_TIMEOUT"));
    }, timeoutMs);
  });

  try {
    const wallpaper = await Promise.race([
      requestWallpaper({ apiOnly, signal: controller?.signal }),
      timeoutPromise,
    ]);

    if (wallpaper?.url) return wallpaper;
    return apiOnly ? wallpaperUnavailableGift : getFallbackWallpaper(pickFallback);
  } catch {
    return apiOnly ? wallpaperUnavailableGift : getFallbackWallpaper(pickFallback);
  } finally {
    clearTimeout(timeoutId);
  }
}


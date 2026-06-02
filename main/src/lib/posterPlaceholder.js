/** Tiny SVG poster — no network, minimal memory. */
export const makePosterDataUri = (label, hue = 210) => {
  const safe = String(label).replace(/[<>&"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue} 85% 55%)"/>
        <stop offset="100%" stop-color="hsl(${(hue + 55) % 360} 80% 48%)"/>
      </linearGradient>
    </defs>
    <rect width="600" height="800" rx="28" fill="url(#g)"/>
    <text x="300" y="420" text-anchor="middle" font-family="system-ui,sans-serif" font-size="36" font-weight="700" fill="#f8fff9">${safe}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const resolveCoverSrc = (item, apiBase) => {
  if (item.coverUrl) {
    if (item.coverUrl.startsWith("http") || item.coverUrl.startsWith("data:")) {
      return item.coverUrl;
    }
    const base = (apiBase || "").replace(/\/$/, "");
    return base ? `${base}${item.coverUrl}` : item.coverUrl;
  }
  return makePosterDataUri(item.title?.slice(0, 12) || "ACG", item.hue ?? 210);
};

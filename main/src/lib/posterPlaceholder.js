/** Muted placeholder when API cover is not ready yet. */
export const makePosterDataUri = (label) => {
  const safe = String(label).replace(/[<>&"]/g, "").slice(0, 24);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stop-color="#3f3f46" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#18181b" stop-opacity="0.9"/>
      </linearGradient>
      <filter id="n">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feBlend in="SourceGraphic" mode="overlay"/>
      </filter>
    </defs>
    <rect width="600" height="800" fill="url(#g)"/>
    <rect width="600" height="800" filter="url(#n)" opacity="0.12"/>
    <text x="300" y="420" text-anchor="middle" font-family="ui-monospace,monospace" font-size="13" letter-spacing="0.2em" fill="#a1a1aa" opacity="0.5">${safe || "POSTER"}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const hasRemoteCover = (item) =>
  Boolean(item?.coverUrl && !String(item.coverUrl).startsWith("data:"));

export const resolveCoverSrc = (item, apiBase) => {
  if (!item?.coverUrl) return null;
  if (item.coverUrl.startsWith("http") || item.coverUrl.startsWith("data:")) {
    return item.coverUrl;
  }
  const base = (apiBase || "").replace(/\/$/, "");
  return base ? `${base}${item.coverUrl}` : item.coverUrl;
};

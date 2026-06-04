import { useMemo, useState } from "react";

import { galleryAlbums } from "../data/galleryAlbums";

const prizes = [
  {
    id: "homepage",
    icon: "HP",
    label: "Homepage Source",
    title: "Homepage Learning Reference",
    description:
      "The early homepage learned from Adrian Hajdin's award-winning website tutorial, then kept being reshaped into Taozhiyy's own visual language.",
    href: "https://github.com/adrianhajdin/award-winning-website#introduction",
    action: "Open reference",
  },
  {
    id: "blog",
    icon: "BG",
    label: "Blog Source",
    title: "Blog Subpage Source",
    description:
      "The blog subpage is based on Hexo and the Butterfly theme. For theme usage, configuration, and attribution details, please refer to Butterfly's official documentation.",
    href: "https://butterfly.js.org/",
    action: "Visit Butterfly",
  },
  {
    id: "wallpaper",
    icon: "WP",
    label: "Wallpaper Gift",
    title: "A Gallery Wallpaper Gift",
    description:
      "You drew a random high-resolution image from the Gallery archive. Open it full size, download it, or simply keep it on screen for a moment.",
    action: "Open wallpaper",
  },
];

const wallpaperPool = galleryAlbums.flatMap((album) =>
  album.images.map((url, index) => ({
    url,
    album: album.title,
    label: `${album.eyebrow} #${String(index + 1).padStart(2, "0")}`,
  }))
);

const fallbackWallpaper = {
  url: galleryAlbums[0]?.cover || "",
  album: galleryAlbums[0]?.title || "Gallery",
  label: "Gallery Gift",
};

const pickWallpaperGift = () => {
  if (!wallpaperPool.length) return fallbackWallpaper;
  return wallpaperPool[Math.floor(Math.random() * wallpaperPool.length)];
};

const Contact = () => {
  const [activePrize, setActivePrize] = useState(prizes[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawCount, setDrawCount] = useState(0);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [activeWallpaper, setActiveWallpaper] = useState(() =>
    pickWallpaperGift()
  );

  const reelItems = useMemo(
    () => [
      prizes[drawCount % prizes.length],
      activePrize,
      prizes[(drawCount + 1) % prizes.length],
    ],
    [activePrize, drawCount]
  );

  const drawPrize = () => {
    if (isDrawing) return;
    setIsDrawing(true);
    const nextPrize = prizes[Math.floor(Math.random() * prizes.length)];

    window.setTimeout(() => {
      if (nextPrize.id === "wallpaper") {
        setActiveWallpaper(pickWallpaperGift());
      }
      setActivePrize(nextPrize);
      setDrawCount((count) => count + 1);
      setIsDrawing(false);
      if (nextPrize.id === "wallpaper") setWallpaperOpen(true);
    }, 1100);
  };

  const openPrize = () => {
    if (activePrize.id === "wallpaper") {
      if (!activeWallpaper) setActiveWallpaper(pickWallpaperGift());
      setWallpaperOpen(true);
      return;
    }
    window.open(activePrize.href, "_blank", "noopener,noreferrer");
  };

  return (
    <section id="end" className="my-20 min-h-96 w-screen px-4 md:px-10">
      <div className="source-arcade-shell">
        <div className="source-arcade-bg-grid" aria-hidden="true" />
        <div className="source-arcade-head">
          <p className="source-arcade-eyebrow">SOURCE LOTTERY</p>
          <h2>桃之夭夭 Source Gacha</h2>
          <p>
            Insert a little curiosity, pull the lever, and let this mini arcade
            machine reveal a source note or a random Gallery wallpaper.
          </p>
        </div>

        <div className="source-arcade-machine">
          <div className="source-machine-crown" aria-hidden="true" />
          <div className="source-arcade-marquee">
            <span />
            <strong>SOURCE GACHA</strong>
            <span />
          </div>

          <div className="source-machine-body">
            <div className="source-screen-bay">
              <div className="source-arcade-screen">
                <div className="source-screen-glass" aria-hidden="true" />
                <div
                  className={
                    isDrawing ? "source-reels is-spinning" : "source-reels"
                  }
                >
                  {reelItems.map((item, index) => (
                    <div
                      className="source-reel-card"
                      key={`${item.id}-${index}-${drawCount}`}
                    >
                      <span>{item.icon}</span>
                      <strong>{item.label}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="source-machine-controls">
              <div
                className={
                  isDrawing
                    ? "source-arcade-lever is-pulled"
                    : "source-arcade-lever"
                }
              >
                <button
                  type="button"
                  onClick={drawPrize}
                  aria-label="Pull to draw a source prize"
                >
                  <span className="source-lever-stick" />
                  <span className="source-lever-ball" />
                </button>
                <p>PULL</p>
              </div>

              <button
                type="button"
                className="source-arcade-draw-btn"
                onClick={drawPrize}
                disabled={isDrawing}
              >
                {isDrawing ? "DRAWING" : "START"}
              </button>

              <div className="source-coin-slot" aria-hidden="true">
                <span />
                <p>COIN</p>
              </div>
            </div>

            <div className="source-prize-panel">
              <p className="source-prize-label">Prize Ticket</p>
              <h3>{isDrawing ? "Drawing..." : activePrize.title}</h3>
              <p>
                {isDrawing
                  ? "The cabinet is spinning a new ticket for you."
                  : activePrize.description}
              </p>
              {!isDrawing &&
                activePrize.id === "wallpaper" &&
                activeWallpaper && (
                  <span className="source-wallpaper-hint">
                    Gift pool: {activeWallpaper.album}
                  </span>
                )}
              <button
                type="button"
                className="source-prize-action"
                onClick={openPrize}
                disabled={isDrawing}
              >
                {activePrize.action}
              </button>
            </div>

            <div
              className={
                isDrawing
                  ? "source-prize-dispenser is-drawing"
                  : "source-prize-dispenser"
              }
              aria-hidden="true"
            >
              <span>{activePrize.icon}</span>
              <strong>{isDrawing ? "..." : activePrize.label}</strong>
            </div>
          </div>

          <div className="source-machine-base" aria-hidden="true" />
        </div>
      </div>

      {wallpaperOpen && (
        <div className="wallpaper-prize-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="wallpaper-prize-backdrop"
            aria-label="Close wallpaper preview"
            onClick={() => setWallpaperOpen(false)}
          />
          <div className="wallpaper-prize-card">
            <button
              type="button"
              className="wallpaper-prize-close"
              onClick={() => setWallpaperOpen(false)}
            >
              Close
            </button>
            <p>Wallpaper Gift</p>
            <h3>{activeWallpaper.label}</h3>
            <span>{activeWallpaper.album}</span>
            <img src={activeWallpaper.url} alt="Taozhiyy gallery wallpaper" />
            <div className="wallpaper-prize-actions">
              <a href={activeWallpaper.url} target="_blank" rel="noopener noreferrer">
                View Full Size
              </a>
              <a href={activeWallpaper.url} download="taozhiyy-gallery-wallpaper.jpg">
                Download Wallpaper
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Contact;

import { useState } from "react";

import { galleryAlbums } from "../data/galleryAlbums";

const SOURCE_ASSET_BASE =
  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/img";

const prizes = [
  {
    id: "homepage",
    icon: "HP",
    label: "Homepage Source",
    title: "Homepage Learning Reference",
    description:
      "The early homepage learned from Adrian Hajdin's award-winning website tutorial, then kept being reshaped into Taozhiyy's own visual language.",
    href: "https://github.com/adrianhajdin/award-winning-website#introduction",
    visual: `${SOURCE_ASSET_BASE}/swordman.webp`,
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
    visual: galleryAlbums[1]?.cover || galleryAlbums[0]?.cover || "",
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

const getDrawDigits = (number) =>
  String(number).padStart(3, "0").split("");

const getPrizeByDrawNumber = (number) => {
  if (number <= 332) return prizes[0];
  if (number <= 665) return prizes[1];
  return prizes[2];
};

const Contact = () => {
  const [activePrize, setActivePrize] = useState(prizes[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawCount, setDrawCount] = useState(0);
  const [drawNumber, setDrawNumber] = useState(0);
  const [slotDigits, setSlotDigits] = useState(() => getDrawDigits(0));
  const [resultOpen, setResultOpen] = useState(false);
  const [activeWallpaper, setActiveWallpaper] = useState(() =>
    pickWallpaperGift()
  );

  const drawPrize = () => {
    if (isDrawing) return;
    setIsDrawing(true);
    setResultOpen(false);
    const nextNumber = Math.floor(Math.random() * 1000);
    const nextPrize = getPrizeByDrawNumber(nextNumber);
    const spinTimer = window.setInterval(() => {
      setSlotDigits(getDrawDigits(Math.floor(Math.random() * 1000)));
    }, 90);

    window.setTimeout(() => {
      window.clearInterval(spinTimer);
      if (nextPrize.id === "wallpaper") {
        setActiveWallpaper(pickWallpaperGift());
      }
      setDrawNumber(nextNumber);
      setSlotDigits(getDrawDigits(nextNumber));
      setActivePrize(nextPrize);
      setDrawCount((count) => count + 1);
      setIsDrawing(false);
      setResultOpen(true);
    }, 1100);
  };

  const openPrize = () => {
    if (activePrize.id === "wallpaper") {
      window.open(
        activeWallpaper?.url || fallbackWallpaper.url,
        "_blank",
        "noopener,noreferrer"
      );
      return;
    }
    window.open(activePrize.href, "_blank", "noopener,noreferrer");
  };

  const resultPoster =
    activePrize.id === "wallpaper"
      ? {
          image: activeWallpaper?.url || fallbackWallpaper.url,
          label: activeWallpaper?.label || fallbackWallpaper.label,
          meta: activeWallpaper?.album || fallbackWallpaper.album,
        }
      : {
          image: activePrize.visual || fallbackWallpaper.url,
          label: activePrize.label,
          meta: activePrize.title,
        };
  const drawCode = String(drawNumber).padStart(3, "0");

  return (
    <section id="end" className="my-20 min-h-96 w-screen px-4 md:px-10">
      <div className="source-arcade-shell">
        <div className="source-arcade-bg-grid" aria-hidden="true" />
        <div className="source-arcade-head">
          <p className="source-arcade-eyebrow">SOURCE LOTTERY</p>
          <h2>桃之夭夭 Source Gacha</h2>
          <p>
            Pull the lever to draw one poster card. The result will pop out at
            the center of the screen as an independent wallpaper-style card.
          </p>
        </div>

        <div className="source-lottery-stage">
          <div className="source-arcade-machine">
            <div className="source-machine-crown" aria-hidden="true" />
            <div className="source-arcade-marquee">
              <span />
              <strong>SOURCE SLOT</strong>
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
                    {slotDigits.map((digit, index) => (
                      <div
                        className="source-reel-card source-digit-card"
                        key={`${index}-${drawCount}`}
                      >
                        <span>{digit}</span>
                        <strong>{["HUN", "TEN", "ONE"][index]}</strong>
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {resultOpen && (
        <div className="wallpaper-prize-modal" role="dialog" aria-modal="true">
          <button
            type="button"
            className="wallpaper-prize-backdrop"
            aria-label="Close source result"
            onClick={() => setResultOpen(false)}
          />
          <div className="wallpaper-prize-card">
            <button
              type="button"
              className="wallpaper-prize-close"
              onClick={() => setResultOpen(false)}
            >
              Close
            </button>
            <p>Source Result</p>
            <h3>{activePrize.title}</h3>
            <span>
              No. {drawCode} · {resultPoster.meta}
            </span>
            <img src={resultPoster.image} alt={`${resultPoster.label} poster`} />
            <p className="wallpaper-prize-description">
              {activePrize.description}
            </p>
            <div className="wallpaper-prize-actions">
              <button type="button" onClick={openPrize}>
                {activePrize.action}
              </button>
              <button type="button" onClick={() => setResultOpen(false)}>
                Keep Reading
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Contact;

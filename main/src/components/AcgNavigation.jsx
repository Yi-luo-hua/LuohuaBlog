import { useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";
import {
  hasRemoteCover,
  makePosterDataUri,
  resolveCoverSrc,
} from "../lib/posterPlaceholder";
import { getBangumiList, getRadarFeed } from "../services/acgApi";

const CARD_SHELL =
  "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0d0d11]/60 backdrop-blur-md transition-all duration-300 hover:border-white/20 active:border-white/20";

const WATCH_BTN =
  "inline-block w-fit rounded-full border border-[#ffd700]/40 bg-transparent px-4 py-1.5 font-mono text-xs uppercase text-[#ffd700] transition-all duration-300 hover:border-[#ffd700] hover:bg-[#ffd700] hover:text-black active:bg-[#ffd700] active:text-black";

const PosterFrame = ({ item, aspectClass = "aspect-[3/4]" }) => {
  const remote = hasRemoteCover(item);
  const src = remote ? resolveCoverSrc(item, API_BASE) : null;

  return (
    <div
      className={`relative w-full shrink-0 overflow-hidden ${aspectClass} bg-zinc-800/40`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-700/25 via-zinc-900/20 to-zinc-950/70"
        aria-hidden
      />
      {remote && src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="relative z-[1] h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <img
          src={makePosterDataUri(item.title)}
          alt=""
          className="relative z-[1] h-full w-full object-cover object-center opacity-90"
        />
      )}
      <div
        className="pointer-events-none absolute inset-0 z-[2] opacity-[0.18] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
        }}
        aria-hidden
      />
    </div>
  );
};

const BangumiCard = ({ item }) => {
  const pct =
    item.total > 0
      ? Math.max(0, Math.min(100, Math.round((item.watched / item.total) * 100)))
      : 0;

  return (
    <article className={CARD_SHELL}>
      <PosterFrame item={item} />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-sm font-bold leading-snug text-zinc-100 sm:text-base">
          {item.title}
        </h3>
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
          Latest ep · {item.latestEpisode ?? item.total}
        </p>

        <div className="mt-4">
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-[#ffd700]/85 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[10px] text-zinc-500">
            {item.watched} / {item.total} watched
          </p>
        </div>

        {item.linkUrl ? (
          <a
            href={item.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${WATCH_BTN} mt-4`}
          >
            Let&apos;s watch
          </a>
        ) : (
          <button type="button" className={`${WATCH_BTN} mt-4`}>
            Let&apos;s watch
          </button>
        )}
      </div>
    </article>
  );
};

const RadarCard = ({ item }) => (
  <article className={CARD_SHELL}>
    {item.isNew && (
      <div
        className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/5 bg-[#0d0d11]/80 px-2 py-1 backdrop-blur-sm"
        aria-label="New update"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
        </span>
        <span className="font-mono text-[9px] uppercase tracking-widest text-red-400/90">
          new
        </span>
      </div>
    )}

    <PosterFrame item={item} aspectClass="aspect-video" />

    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <h3 className="pr-14 text-sm font-bold leading-snug text-zinc-100 sm:text-base">
        {item.creatorName}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.latestText}</p>
      {item.linkUrl && (
        <a
          href={item.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${WATCH_BTN} mt-4`}
        >
          Open feed
        </a>
      )}
    </div>
  </article>
);

const SectionTitle = ({ children }) => (
  <h3 className="mb-4 px-1 font-mono text-xs font-medium uppercase tracking-[0.35em] text-[#ffd700]/70">
    {children}
  </h3>
);

const AcgNavigation = () => {
  const [bangumiList, setBangumiList] = useState([]);
  const [radarList, setRadarList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [bangumi, radar] = await Promise.all([getBangumiList(), getRadarFeed()]);
      if (!cancelled) {
        setBangumiList(bangumi);
        setRadarList(radar);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="acg" className="bg-black pb-16 pt-4">
      <div className="container mx-auto px-3 md:px-10">
        <header className="mb-8 px-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-zinc-500">
            Tracker
          </p>
          <h2 className="mt-2 font-zentry text-2xl font-black uppercase text-zinc-100 md:text-4xl">
            Bangumi & Creators
          </h2>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 p-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((k) => (
              <div
                key={k}
                className={`${CARD_SHELL} h-72 animate-pulse border-white/[0.03]`}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="mb-12 px-1">
              <SectionTitle>追番大追击</SectionTitle>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {bangumiList.map((item) => (
                  <BangumiCard key={item.id} item={item} />
                ))}
              </div>
            </div>

            <div className="px-1">
              <SectionTitle>大佬动态雷达</SectionTitle>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {radarList.map((item) => (
                  <RadarCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default AcgNavigation;

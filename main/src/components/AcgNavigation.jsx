import { useEffect, useState } from "react";
import { API_BASE } from "../lib/apiBase";
import { resolveCoverSrc } from "../lib/posterPlaceholder";
import { getBangumiList, getRadarFeed } from "../services/acgApi";

const BangumiCard = ({ item }) => {
  const pct =
    item.total > 0
      ? Math.max(0, Math.min(100, Math.round((item.watched / item.total) * 100)))
      : 0;

  return (
    <article className="relative h-auto overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 text-blue-50">
      <div className="flex flex-col gap-3">
        <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-black/30">
          <img
            src={resolveCoverSrc(item, API_BASE)}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <h3 className="text-sm break-words font-bold leading-snug">{item.title}</h3>
          <p className="mt-1 text-[11px] text-white/60">
            Latest ep · {item.latestEpisode ?? item.total}
          </p>
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-yellow-300 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-white/70">
              You · {item.watched}/{item.total}
            </p>
          </div>
        </div>
        {item.linkUrl ? (
          <a
            href={item.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block w-fit rounded-full bg-yellow-400 px-4 py-2 text-xs font-bold uppercase text-black"
          >
            Let&apos;s Watch
          </a>
        ) : (
          <button
            type="button"
            className="mt-1 w-fit rounded-full bg-yellow-400 px-4 py-2 text-xs font-bold uppercase text-black"
          >
            Let&apos;s Watch
          </button>
        )}
      </div>
    </article>
  );
};

const RadarCard = ({ item }) => (
  <article className="relative h-auto overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 text-blue-50">
    {item.coverUrl && (
      <div className="mb-3 aspect-video w-full overflow-hidden rounded-lg bg-black/30">
        <img
          src={resolveCoverSrc(item, API_BASE)}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    )}
    {item.isNew && (
      <>
        <span className="absolute right-4 top-4 h-3 w-3 animate-pulse rounded-full bg-red-500" />
        <span className="absolute right-9 top-3 rounded bg-red-500/90 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
          New
        </span>
      </>
    )}
    <h3 className="break-words pr-16 text-sm font-bold leading-snug">{item.creatorName}</h3>
    <p className="mt-3 break-words text-[12px] leading-snug text-white/80">{item.latestText}</p>
    {item.linkUrl && (
      <a
        href={item.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-block text-[11px] font-semibold uppercase tracking-wide text-yellow-300"
      >
        Open feed →
      </a>
    )}
  </article>
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
          <h2 className="font-zentry text-2xl font-black uppercase text-blue-50 md:text-4xl">
            Bangumi & Creators
          </h2>
        </header>

        {loading ? (
          <p className="px-4 text-sm text-white/50">Loading feed…</p>
        ) : (
          <>
            <div className="mb-10 px-2">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-yellow-300">
                追番大追击
              </h3>
              <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {bangumiList.map((item) => (
                  <BangumiCard key={item.id} item={item} />
                ))}
              </div>
            </div>

            <div className="px-2">
              <h3 className="mb-4 text-sm font-bold uppercase tracking-widest text-yellow-300">
                大佬动态雷达
              </h3>
              <div className="grid grid-cols-1 gap-6 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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

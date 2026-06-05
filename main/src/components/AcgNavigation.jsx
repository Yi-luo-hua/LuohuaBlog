import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../lib/apiBase";
import {
  hasRemoteCover,
  makePosterDataUri,
  resolveCoverSrc,
} from "../lib/posterPlaceholder";
import { getBangumiList, getRadarFeed } from "../services/acgApi";

const BANGUMI_CARD =
  "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#7C5CFF]/15 bg-white/50 shadow-[0_8px_32px_rgba(124,92,255,0.08)] backdrop-blur-xl transition-all duration-300 hover:border-[#FF6BAA]/35 hover:shadow-[0_12px_40px_rgba(255,107,170,0.12)] active:border-[#00C2FF]/40";

const RADAR_OUTER =
  "group rounded-2xl bg-gradient-to-br from-[#7C5CFF]/50 via-[#FF6BAA]/45 to-[#00C2FF]/50 p-[2px] shadow-[0_10px_36px_rgba(124,92,255,0.14)] transition-all duration-300 hover:from-[#7C5CFF]/70 hover:via-[#FF6BAA]/60 hover:to-[#00C2FF]/65";

const RADAR_INNER =
  "relative flex h-full flex-col overflow-hidden rounded-[14px] bg-white/62 backdrop-blur-xl";

const CANDY_BTN =
  "inline-block w-fit rounded-full border border-[#7C5CFF]/45 bg-white/30 px-4 py-1.5 font-mono text-xs uppercase text-[#7C5CFF] backdrop-blur-sm transition-all duration-300 hover:border-[#7C5CFF] hover:bg-[#7C5CFF] hover:text-white active:scale-[0.98]";

const MOBILE_BANGUMI_LIMIT = 3;

const EXPAND_BTN =
  "rounded-full border border-[#00C2FF]/50 bg-white/60 px-5 py-2 font-mono text-xs uppercase tracking-wide text-[#2D2A3A] shadow-sm backdrop-blur-md transition-all duration-300 hover:border-[#00C2FF] hover:bg-[#00C2FF]/10 active:scale-[0.98]";

const creatorTag = (name = "") =>
  String(name)
    .replace(/^UP\s*·\s*/i, "")
    .trim()
    .slice(0, 18);

const creatorInitials = (name = "") => {
  const cleaned = creatorTag(name);
  if (!cleaned) return "UP";
  if (/\s/.test(cleaned)) {
    return cleaned
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");
  }
  return cleaned.slice(0, 2).toUpperCase();
};

const PosterFrame = ({ item, variant = "bangumi", aspectClass = "aspect-[3/4]" }) => {
  const remote = hasRemoteCover(item);
  const src = remote ? resolveCoverSrc(item, API_BASE) : null;
  const isRadar = variant === "radar";

  return (
    <div
      className={`relative w-full shrink-0 overflow-hidden ${aspectClass} ${
        isRadar ? "bg-[#FFF9E6]/80" : "bg-[#EAF6FF]/60"
      }`}
    >
      {!isRadar && (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#EAF6FF]/80 via-[#FFEAF4]/40 to-[#F3E8FF]/90"
          aria-hidden
        />
      )}
      {remote && src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="relative z-[1] h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : isRadar ? (
        <div className="relative z-[1] flex h-full w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#FFF8D8] via-[#FFE8F2] to-[#E9F7FF]">
          <div className="absolute -right-6 -top-8 h-20 w-20 rounded-full bg-[#FF6BAA]/20 blur-md" />
          <div className="absolute -left-6 -bottom-8 h-20 w-20 rounded-full bg-[#00C2FF]/20 blur-md" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(124,92,255,0.10)_1px,transparent_1px),linear-gradient(to_bottom,rgba(124,92,255,0.10)_1px,transparent_1px)] bg-[size:18px_18px]" />
          <div className="absolute right-6 top-4 text-[#FF6BAA]/50">✦</div>
          <div className="absolute left-8 bottom-4 text-[#7C5CFF]/35">✧</div>
          <div className="relative flex items-center gap-3 rounded-full border border-white/70 bg-white/70 px-4 py-2 backdrop-blur-sm">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C5CFF]/15 font-mono text-xs font-semibold text-[#7C5CFF]">
              {creatorInitials(item.creatorName)}
            </div>
            <div className="max-w-[11rem]">
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-[#7C5CFF]/75">
                Creator
              </p>
              <p className="truncate text-xs font-semibold text-[#2D2A3A]/85">
                {creatorTag(item.creatorName) || "Bili Creator"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <img
          src={makePosterDataUri(item.title, variant)}
          alt=""
          className="relative z-[1] h-full w-full object-cover object-center"
        />
      )}
    </div>
  );
};

const BangumiCard = ({ item }) => (
  <article className={BANGUMI_CARD}>
    <PosterFrame item={item} variant="bangumi" />
    <div className="flex flex-1 flex-col p-4 sm:p-5">
      <h3 className="text-sm font-bold leading-snug text-[#2D2A3A] sm:text-base">
        {item.title}
      </h3>
      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-[#7C5CFF]/70">
        Latest ep · {item.latestEpisode ?? item.total}
      </p>
      <p className="mt-1 text-[11px] text-[#2D2A3A]/55">
        {item.watched} / {item.total} eps
      </p>

      {item.linkUrl ? (
        <a
          href={item.linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${CANDY_BTN} mt-4`}
        >
          Let&apos;s watch
        </a>
      ) : (
        <button type="button" className={`${CANDY_BTN} mt-4`}>
          Let&apos;s watch
        </button>
      )}
    </div>
  </article>
);

const RadarCard = ({ item }) => (
  <div className={RADAR_OUTER}>
    <article className={RADAR_INNER}>
      {item.isNew && (
        <div
          className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full border border-[#FF6BAA]/30 bg-white/75 px-2 py-0.5 backdrop-blur-md"
          aria-label="New update"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF6BAA]/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#FF6BAA]" />
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-[#FF6BAA]">
            new
          </span>
        </div>
      )}

      <PosterFrame item={item} variant="radar" aspectClass="aspect-video" />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="pr-12 text-sm font-bold leading-snug text-[#2D2A3A] sm:text-base">
          {item.creatorName}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#2D2A3A]/70">{item.latestText}</p>
        {item.linkUrl && (
          <a
            href={item.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${CANDY_BTN} mt-4 border-[#FF6BAA]/45 text-[#FF6BAA] hover:border-[#FF6BAA] hover:bg-[#FF6BAA] hover:text-white`}
          >
            Open feed
          </a>
        )}
      </div>
    </article>
  </div>
);

const SectionTitle = ({ children, accent = "#7C5CFF" }) => (
  <h3
    className="mb-4 px-1 font-mono text-xs font-semibold uppercase tracking-[0.35em]"
    style={{ color: accent }}
  >
    {children}
  </h3>
);

const AcgNavigation = () => {
  const [bangumiList, setBangumiList] = useState([]);
  const [radarList, setRadarList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bangumiExpanded, setBangumiExpanded] = useState(false);
  const [bangumiRefreshing, setBangumiRefreshing] = useState(false);
  const bangumiSectionRef = useRef(null);

  const hiddenBangumiCount = Math.max(0, bangumiList.length - MOBILE_BANGUMI_LIMIT);
  const showBangumiToggle = hiddenBangumiCount > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setBangumiExpanded(false);
      const [bangumi, radar] = await Promise.all([getBangumiList(), getRadarFeed()]);
      if (!cancelled) {
        setBangumiList(Array.isArray(bangumi) ? bangumi : []);
        setRadarList(Array.isArray(radar) ? radar : []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleBangumiToggle = async () => {
    if (bangumiExpanded) {
      setBangumiRefreshing(true);
      setBangumiExpanded(false);
      try {
        const fresh = await getBangumiList();
        setBangumiList(fresh);
      } finally {
        setBangumiRefreshing(false);
      }
      bangumiSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setBangumiExpanded(true);
  };

  return (
    <section id="acg" className="pb-16 pt-2">
      <div className="container mx-auto px-3 md:px-10">
        <header className="mb-8 px-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#00C2FF]/90">
            Tracker
          </p>
          <h2 className="mt-2 font-zentry text-2xl font-black uppercase text-[#2D2A3A] md:text-4xl">
            Bangumi & Creators
          </h2>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 p-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((k) => (
              <div
                key={k}
                className="h-72 animate-pulse rounded-2xl border border-white/60 bg-white/40 backdrop-blur-md"
              />
            ))}
          </div>
        ) : (
          <>
            <div ref={bangumiSectionRef} className="mb-12 scroll-mt-28 px-1">
              <SectionTitle accent="#7C5CFF">追番大追击</SectionTitle>
              <p className="mb-3 px-1 text-[11px] text-[#2D2A3A]/50 md:hidden">
                {bangumiExpanded
                  ? "以下为展开条目（青框高亮）"
                  : `手机端默认展示 ${MOBILE_BANGUMI_LIMIT} 部`}
              </p>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {bangumiList.map((item, index) => {
                  const isExtra = index >= MOBILE_BANGUMI_LIMIT;
                  const revealed = bangumiExpanded && isExtra;

                  return (
                    <div
                      key={item.id}
                      className={clsx(
                        isExtra && !bangumiExpanded && "hidden md:block",
                        revealed &&
                          "max-md:animate-[bangumiReveal_0.45s_ease-out_forwards] max-md:rounded-2xl max-md:ring-2 max-md:ring-[#00C2FF]/45 max-md:ring-offset-2 max-md:ring-offset-[#EAF6FF]",
                      )}
                    >
                      {revealed && (
                        <span className="mb-1.5 inline-block rounded-full bg-[#00C2FF]/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[#00C2FF] md:hidden">
                          more
                        </span>
                      )}
                      <BangumiCard item={item} />
                    </div>
                  );
                })}
              </div>

              {showBangumiToggle && (
                <div className="mt-6 flex flex-col items-center gap-2 md:hidden">
                  <button
                    type="button"
                    onClick={handleBangumiToggle}
                    disabled={bangumiRefreshing}
                    className={EXPAND_BTN}
                    aria-expanded={bangumiExpanded}
                  >
                    {bangumiRefreshing
                      ? "刷新中…"
                      : bangumiExpanded
                        ? "收起并刷新"
                        : `展开更多 (+${hiddenBangumiCount})`}
                  </button>
                  {!bangumiExpanded && (
                    <p className="text-center text-[10px] text-[#2D2A3A]/45">
                      点击展开其余 {hiddenBangumiCount} 部；收起将重置列表
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="px-1">
              <SectionTitle accent="#FF6BAA">作者再看</SectionTitle>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {radarList.length ? (
                  radarList.map((item) => <RadarCard key={item.id} item={item} />)
                ) : (
                  <article className="col-span-full overflow-hidden rounded-2xl border border-[#FF6BAA]/20 bg-white/68 p-5 shadow-[0_10px_30px_rgba(255,107,170,0.08)] backdrop-blur-xl">
                    <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#FF6BAA]/78">
                      Creator radar
                    </p>
                    <h3 className="mt-2 text-base font-bold text-[#2D2A3A] sm:text-lg">
                      暂未同步到新的 UP 动态
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#2D2A3A]/65">
                      这里现在不会再拿英文假卡片冒充更新了。等雷达同步恢复后，会直接显示真实的 B 站创作者内容。
                    </p>
                    <a
                      href="https://space.bilibili.com/1061280173"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${CANDY_BTN} mt-4 border-[#FF6BAA]/45 text-[#FF6BAA] hover:border-[#FF6BAA] hover:bg-[#FF6BAA] hover:text-white`}
                    >
                      Open Bilibili
                    </a>
                  </article>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default AcgNavigation;

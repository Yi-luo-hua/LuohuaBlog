import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../lib/apiBase";
import {
  hasRemoteCover,
  makePosterDataUri,
  resolveCoverSrc,
} from "../lib/posterPlaceholder";
import { getBangumiCollection } from "../services/acgApi";

const STATUS_COPY = {
  watching: {
    emptyEyebrow: "Watching list",
    emptyTitle: "“在看”列表还是空的",
    emptyNote: "在 Bangumi 标记为“在看”的动画会出现在这里。",
  },
  watched: {
    emptyEyebrow: "Completed list",
    emptyTitle: "“看过”列表还是空的",
    emptyNote: "在 Bangumi 标记为“看过”的动画会出现在这里。",
  },
  wish: {
    emptyEyebrow: "Wish list",
    emptyTitle: "“想看”列表还是空的",
    emptyNote: "在 Bangumi 标记为“想看”的动画会出现在这里。",
  },
};

const formatAirDate = (value) => {
  const matched = /^(\d{4})-(\d{1,2})/.exec(String(value || ""));
  if (!matched) return "";
  return `${matched[1]}年${Number(matched[2])}月`;
};

const columnsForViewport = () => {
  if (typeof window === "undefined") return 5;
  if (window.innerWidth >= 1280) return 5;
  if (window.innerWidth >= 1024) return 4;
  if (window.innerWidth >= 768) return 3;
  if (window.innerWidth >= 640) return 2;
  return 1;
};

const useGridColumns = () => {
  const [columns, setColumns] = useState(columnsForViewport);

  useEffect(() => {
    const update = () => setColumns(columnsForViewport());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return columns;
};

// The viewport shows roughly two rows at first glance. Those are the cards
// worth spending on: they animate in and their covers are fetched eagerly.
//
// Everything below the fold used to get the same treatment, and that is what
// made the entrance stutter — two hundred cards each carrying `will-change`
// and a blur keyframe means two hundred compositor layers animating while a
// hundred covers decode. Deferred cards never animate at all; by the time one
// is scrolled into view the entrance is long finished, so there is nothing to
// see either way.
const FIRST_GLANCE_ROWS = 2;
const FIRST_PAINT_ROWS = 4;
const APPEND_ROWS = 6;
const GROW_MARGIN_PX = 900;

const rippleStyle = (index, columns) => {
  const column = index % columns;
  const row = Math.floor(index / columns);
  const distance = Math.hypot(column, row * 0.76);

  return {
    "--ripple-delay": `${Math.min(620, Math.round(distance * 78))}ms`,
    "--ripple-x": `${Math.max(-36, column * -12)}px`,
    "--ripple-y": `${Math.max(-28, row * -7)}px`,
  };
};

const BangumiCard = ({ item, index, priority = false }) => {
  const cover = hasRemoteCover(item)
    ? resolveCoverSrc(item, API_BASE)
    : makePosterDataUri(item.title, "bangumi");
  const airDate = formatAirDate(item.airDate);
  const tags = Array.isArray(item.tags)
    ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];
  const visibleTags = tags.slice(0, 2);
  const hiddenTagCount = Math.max(0, tags.length - visibleTags.length);

  return (
    <article className="group relative grid h-full overflow-hidden rounded-3xl border border-[#19324a]/10 bg-[#fffdf8]/85 shadow-[0_18px_45px_rgba(52,72,92,0.10)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(52,72,92,0.16)] sm:block">
      <div className="absolute left-3 top-3 z-10 rounded-full border border-white/70 bg-[#fffdf8]/85 px-2.5 py-1 font-mono text-[10px] tracking-[0.18em] text-[#19324a]/70 backdrop-blur">
        {String(index + 1).padStart(2, "0")}
      </div>

      <div className="relative min-h-52 overflow-hidden bg-[#dcecf2] sm:aspect-[3/4] sm:min-h-0">
        <img
          src={cover}
          alt={`${item.title} 封面`}
          // A cover that is already on screen gains nothing from being lazy:
          // the browser has to finish layout before it will even start the
          // request, which is exactly the delay the entrance animation runs
          // into.
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          className="size-full object-cover transition duration-500 group-hover:scale-[1.025]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#172d40]/55 to-transparent" />
        {(item.score > 0 || item.myRating > 0) && (
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
            {item.score > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-[#172d40]/85 px-3 py-1.5 font-mono text-sm font-semibold text-white shadow-lg backdrop-blur">
                <span
                  className="text-lg leading-none text-[#ffd84d]"
                  aria-hidden
                >
                  ★
                </span>
                {Number(item.score).toFixed(1)}
              </span>
            )}
            {item.myRating > 0 && (
              <span className="rounded-full border border-white/30 bg-[#3478c9]/90 px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide text-white shadow-md backdrop-blur">
                我的评分 {item.myRating}
              </span>
            )}
          </div>
        )}
        {visibleTags.length > 0 && (
          <div className="absolute inset-x-3 bottom-3 flex min-w-0 items-center gap-1.5 overflow-hidden">
            {visibleTags.map((tag) => (
              <span
                key={tag}
                className="max-w-28 truncate rounded-md border border-white/20 bg-[#172d40]/65 px-2 py-1 text-[10px] text-white/90 backdrop-blur"
              >
                {tag}
              </span>
            ))}
            {hiddenTagCount > 0 && (
              <span className="shrink-0 rounded-md border border-white/20 bg-[#172d40]/65 px-2 py-1 font-mono text-[10px] text-white/90 backdrop-blur">
                +{hiddenTagCount}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col p-3.5 sm:min-h-48 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[#172d40]">
              {item.title}
            </h3>
            {item.originalTitle && item.originalTitle !== item.title && (
              <p className="mt-1 line-clamp-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#687b89]">
                {item.originalTitle}
              </p>
            )}
          </div>
          {item.rank > 0 && (
            <span className="shrink-0 rounded-full bg-[#dcecf2] px-2.5 py-1 font-mono text-[10px] text-[#34556b]">
              #{item.rank}
            </span>
          )}
        </div>

        {item.summary && (
          <p className="mt-2.5 line-clamp-2 text-[11px] leading-[1.15rem] text-[#536976]">
            {item.summary}
          </p>
        )}

        <div className="mt-auto pt-5">
          {airDate && (
            <p className="text-right text-xs text-[#526976]">{airDate}</p>
          )}

          <a
            href={item.linkUrl || "https://bgm.tv/"}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#315c72] transition hover:text-[#e36f61]"
          >
            在 Bangumi 查看 <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
    </article>
  );
};

const LoadingShelf = () => (
  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
    {[0, 1, 2, 3, 4].map((item) => (
      <div
        key={item}
        className="h-[25rem] animate-pulse rounded-3xl border border-white/60 bg-white/45"
      />
    ))}
  </div>
);

const BangumiShelf = ({ status: collectionStatus = "watching", onCounts }) => {
  const [items, setItems] = useState([]);
  const [requestStatus, setRequestStatus] = useState("loading");
  const [renderRows, setRenderRows] = useState(FIRST_PAINT_ROWS);
  const columns = useGridColumns();

  const sentinelRef = useRef(null);
  const firstGlanceCount = columns * FIRST_GLANCE_ROWS;
  const renderCount = columns * renderRows;
  const visibleItems = useMemo(
    () => items.slice(0, renderCount),
    [items, renderCount],
  );

  // Grow the shelf as it is scrolled rather than mounting all of it up front.
  //
  // loading="lazy" is not a substitute: it defers nothing once a card is in the
  // document, so all 201 covers were being fetched before a single one had been
  // scrolled to. Controlling how many cards exist is the only reliable lever.
  //
  // This measures the sentinel's position on scroll instead of using an
  // IntersectionObserver. An observer is the tidier tool, but it only reports
  // while the page is compositing frames, and a shelf that silently stops at
  // twenty of two hundred entries is a much worse failure than a scroll
  // listener that costs one getBoundingClientRect per event.
  useEffect(() => {
    if (requestStatus !== "ready" || renderCount >= items.length) return undefined;
    const node = sentinelRef.current;
    if (!node) return undefined;

    const grow = () => {
      if (node.getBoundingClientRect().top <= window.innerHeight + GROW_MARGIN_PX) {
        setRenderRows((rows) => rows + APPEND_ROWS);
      }
    };

    // Run once immediately: on a tall window the first batch may not even
    // reach the fold, and nothing would ever scroll to trigger the rest.
    grow();
    window.addEventListener("scroll", grow, { passive: true });
    window.addEventListener("resize", grow);
    return () => {
      window.removeEventListener("scroll", grow);
      window.removeEventListener("resize", grow);
    };
  }, [requestStatus, items.length, renderCount]);

  const load = useCallback(async () => {
    setRequestStatus("loading");
    setRenderRows(FIRST_PAINT_ROWS);
    try {
      const data = await getBangumiCollection(collectionStatus);
      setItems(data.items);
      onCounts?.(data.counts);
      setRequestStatus("ready");
    } catch {
      setRequestStatus("error");
    }
  }, [collectionStatus, onCounts]);

  useEffect(() => {
    let active = true;
    setRequestStatus("loading");
    setRenderRows(FIRST_PAINT_ROWS);
    getBangumiCollection(collectionStatus)
      .then((data) => {
        if (!active) return;
        setItems(data.items);
        onCounts?.(data.counts);
        setRequestStatus("ready");
      })
      .catch(() => {
        if (active) setRequestStatus("error");
      });
    return () => {
      active = false;
    };
  }, [collectionStatus, onCounts]);

  if (requestStatus === "loading") return <LoadingShelf />;

  if (requestStatus === "error") {
    return (
      <div className="rounded-[1.75rem] border border-[#d88072]/25 bg-[#fffaf3]/85 p-8 text-center shadow-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#c76054]">
          Sync unavailable
        </p>
        <h2 className="mt-3 text-xl font-semibold text-[#172d40]">
          暂时没有读到 Bangumi 数据
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#61727d]">
          后端可能正在首次同步。稍等片刻后再试一次即可。
        </p>
        <button
          type="button"
          onClick={load}
          className="mt-5 rounded-full bg-[#172d40] px-5 py-2.5 text-sm text-white transition hover:bg-[#e36f61]"
        >
          重新读取
        </button>
      </div>
    );
  }

  if (!items.length) {
    const copy = STATUS_COPY[collectionStatus] || STATUS_COPY.watching;
    return (
      <div className="rounded-[1.75rem] border border-[#19324a]/10 bg-[#fffdf8]/80 p-10 text-center shadow-sm">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#6d8290]">
          {copy.emptyEyebrow}
        </p>
        <h2 className="mt-3 text-xl font-semibold text-[#172d40]">
          {copy.emptyTitle}
        </h2>
        <p className="mt-2 text-sm text-[#61727d]">{copy.emptyNote}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visibleItems.map((item, index) => {
          const firstGlance = index < firstGlanceCount;
          return (
            <div
              key={item.id}
              className={
                firstGlance
                  ? "bangumi-card-ripple h-full"
                  : "bangumi-card-deferred h-full"
              }
              style={firstGlance ? rippleStyle(index, columns) : undefined}
            >
              <BangumiCard item={item} index={index} priority={firstGlance} />
            </div>
          );
        })}
      </div>
      {renderCount < items.length && (
        <div ref={sentinelRef} aria-hidden className="h-px w-full" />
      )}
    </>
  );
};

export default BangumiShelf;

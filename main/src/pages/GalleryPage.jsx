import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { galleryPhotosNewestFirst } from "../data/galleryPhotos";
import { buildJustifiedRows } from "../lib/justifiedRows";

// 窄屏用矮一点的行高，一行才装得下一两张，不至于把照片压成一条。
const rowHeightFor = (width) => {
  if (width < 640) return 220;
  if (width < 1024) return 260;
  return 300;
};

const gapFor = (width) => (width < 640 ? 10 : 16);

// 行宽由容器实测宽度决定，所以要跟着容器变化重算。
const useMeasuredWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const measure = () => setWidth(node.clientWidth);
    measure();

    // 首帧量到 0 的情况是有的：标签页在后台、字体或样式还没生效。下一帧补量一次，
    // 否则相册会一直空着，直到用户碰巧改了窗口大小。
    const retry = requestAnimationFrame(measure);

    // 两条路一起挂：ResizeObserver 管容器自身变宽变窄（比如侧栏开合），
    // resize 管视口变化——后台标签页里 observer 的回调可能根本不派发。
    window.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);

    return () => {
      cancelAnimationFrame(retry);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);

  return [ref, width];
};

const GalleryEmptyState = () => (
  <div className="relative overflow-hidden rounded-[2rem] border border-dashed border-[#ffc8d6] bg-white/55 px-6 py-16 text-center shadow-[0_28px_90px_rgba(95,75,82,0.1)] backdrop-blur-md md:px-16 md:py-24">
    <p className="font-general text-[10px] uppercase tracking-[0.36em] text-[#b76e79]">
      00 Photos
    </p>
    <h2 className="mt-4 text-3xl font-black leading-tight text-[#241322] md:text-4xl">
      相册正在重新整理
    </h2>
    <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[#5f4b52]">
      旧模板留下的图片已经清空，这里很快会换上我自己拍的照片。
    </p>
  </div>
);

const GalleryPage = () => {
  const [containerRef, containerWidth] = useMeasuredWidth();
  const photos = galleryPhotosNewestFirst;
  const gap = gapFor(containerWidth);

  const rows = useMemo(
    () =>
      buildJustifiedRows(photos, {
        containerWidth,
        gap: gapFor(containerWidth),
        targetRowHeight: rowHeightFor(containerWidth),
      }),
    [photos, containerWidth],
  );

  let rendered = 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fff8f1] pt-24 text-[#241322]">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_18%_18%,rgba(255,143,171,0.22),transparent_32%),radial-gradient(circle_at_82%_12%,rgba(124,92,255,0.14),transparent_28%),linear-gradient(135deg,#fff8f1_0%,#ffeef5_48%,#f6fbff_100%)]"
        aria-hidden="true"
      />
      <div className="pointer-events-none fixed left-1/2 top-24 -z-10 h-56 w-[78vw] -translate-x-1/2 rounded-full bg-white/55 blur-3xl" />

      <header className="container mx-auto px-5 pb-10 md:px-10">
        <p className="font-general text-xs uppercase tracking-[0.45em] text-[#b76e79]">
          Unified Gallery
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-zentry text-5xl font-black uppercase leading-none text-[#241322] md:text-7xl">
            伊洛华
            <span className="block text-[#ff8fab]">Gallery</span>
          </h1>
          {photos.length > 0 ? (
            <p className="font-general text-[10px] uppercase tracking-[0.36em] text-[#b76e79]">
              {String(photos.length).padStart(2, "0")} Photos · Newest First
            </p>
          ) : null}
        </div>
      </header>

      <section className="container mx-auto px-5 pb-24 md:px-10">
        {photos.length === 0 ? (
          <GalleryEmptyState />
        ) : (
          <div ref={containerRef}>
            {rows.map((row, rowIndex) => (
              <div
                key={row.items[0].photo.id}
                className="flex"
                style={{
                  gap: `${gap}px`,
                  marginBottom: rowIndex === rows.length - 1 ? 0 : `${gap}px`,
                }}
              >
                {row.items.map(({ photo, width, height }) => {
                  const eager = rendered < 6;
                  rendered += 1;

                  return (
                    <Link
                      key={photo.id}
                      to={`/gallery/${photo.id}`}
                      style={{ width: `${width}px`, height: `${height}px` }}
                      className="group relative shrink-0 overflow-hidden rounded-2xl bg-white/55 shadow-[0_14px_40px_rgba(95,75,82,0.12)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(255,143,171,0.24)]"
                      aria-label={photo.title || "查看大图"}
                    >
                      <img
                        src={photo.thumb || photo.src}
                        alt={photo.title || ""}
                        width={photo.width}
                        height={photo.height}
                        className="size-full object-contain transition duration-700 group-hover:scale-[1.03]"
                        loading={eager ? "eager" : "lazy"}
                        decoding="async"
                      />
                      {photo.title ? (
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-4 pb-3 pt-8 text-sm text-white opacity-0 transition duration-500 group-hover:opacity-100">
                          {photo.title}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default GalleryPage;

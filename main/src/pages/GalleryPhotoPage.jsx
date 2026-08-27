import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { TiLocationArrow } from "react-icons/ti";
import {
  FiZoomIn,
  FiZoomOut,
  FiRotateCcw,
  FiExternalLink,
  FiChevronLeft,
  FiChevronRight,
  FiMaximize,
  FiMinimize,
} from "react-icons/fi";
import { getGalleryPhoto, getGalleryPhotoNeighbours } from "../data/galleryPhotos";

const formatPublishedAt = (value) => {
  const parsed = Date.parse(value ?? "");
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const GalleryPhotoPage = () => {
  const { photoId } = useParams();
  const navigate = useNavigate();
  const photo = getGalleryPhoto(photoId);
  const { previous, next, index } = getGalleryPhotoNeighbours(photoId);

  const stageScrollRef = useRef(null);

  // 缩放状态 (1 = 默认长卷/适应宽度, 1.5 ~ 3 = 细节放大)
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState("scroll"); // 'scroll' (长卷宽幅滚动) | 'fit' (整屏完全适应)

  // 换照片时复位滚动位置与缩放
  useEffect(() => {
    setZoom(1);
    if (stageScrollRef.current) {
      stageScrollRef.current.scrollTop = 0;
      stageScrollRef.current.scrollLeft = 0;
    }
  }, [photoId]);

  useEffect(() => {
    if (!photo) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") navigate("/gallery");
      if (event.key === "+" || event.key === "=") {
        setZoom((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))));
      }
      if (event.key === "-" || event.key === "_") {
        setZoom((prev) => Math.max(0.75, Number((prev - 0.25).toFixed(2))));
      }
      if (event.key === "0") setZoom(1);
      if (event.key === "ArrowLeft" && previous) navigate(`/gallery/${previous.id}`);
      if (event.key === "ArrowRight" && next) navigate(`/gallery/${next.id}`);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photo, previous, next, navigate]);

  if (!photo) return <Navigate to="/gallery" replace />;

  const publishedAt = formatPublishedAt(photo.publishedAt);
  const hasSize = photo.width > 0 && photo.height > 0;
  const isPortrait = hasSize ? photo.height > photo.width : false;

  const handleImageClick = () => {
    // 点击图片在 1x 和 1.6x 放大镜之间切换
    if (zoom === 1) {
      setZoom(1.6);
    } else {
      setZoom(1);
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fff8f1] pt-20 pb-16 text-[#241322]">
      {/* 柔和环境光渐变 */}
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(135deg,#fff8f1_0%,#ffeef5_48%,#f6fbff_100%)]"
        aria-hidden="true"
      />

      {/* 顶部极简导航栏 */}
      <header className="container mx-auto flex items-center justify-between px-4 pb-4 md:px-8 max-w-[1500px]">
        <Link
          to="/gallery"
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5f4b52] shadow-[0_10px_30px_rgba(95,75,82,0.08)] backdrop-blur-md transition-all hover:bg-white/90 hover:shadow-[0_12px_36px_rgba(95,75,82,0.12)]"
        >
          <TiLocationArrow className="rotate-180 text-sm" />
          <span>Gallery 相册</span>
        </Link>

        <div className="flex items-center gap-2">
          {previous ? (
            <Link
              to={`/gallery/${previous.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/65 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5f4b52] shadow-[0_8px_24px_rgba(95,75,82,0.06)] backdrop-blur-md transition-all hover:bg-white/90"
              title="上一张 (←)"
            >
              <FiChevronLeft className="text-sm" />
              <span className="hidden sm:inline">上一张</span>
            </Link>
          ) : null}
          {next ? (
            <Link
              to={`/gallery/${next.id}`}
              className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/65 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#5f4b52] shadow-[0_8px_24px_rgba(95,75,82,0.06)] backdrop-blur-md transition-all hover:bg-white/90"
              title="下一张 (→)"
            >
              <span className="hidden sm:inline">下一张</span>
              <FiChevronRight className="text-sm" />
            </Link>
          ) : null}
        </div>
      </header>

      {/* Pixiv 级双栏黄金画廊布局 */}
      <main className="container mx-auto px-4 md:px-8 max-w-[1500px]">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-6 items-start">
          
          {/* 左侧：超大主舞台（支持长卷滚轮纵向浏览与缩放） */}
          <section className="relative rounded-[2rem] border border-white/80 bg-white/60 p-3 sm:p-4 shadow-[0_28px_80px_rgba(95,75,82,0.12)] backdrop-blur-2xl">
            {/* 动态氛围背景光 */}
            <div
              className="pointer-events-none absolute -inset-4 -z-10 rounded-[3rem] opacity-35 blur-3xl transition-opacity duration-700"
              style={{
                backgroundImage: `url(${photo.thumb || photo.src})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
              aria-hidden="true"
            />

            {/* 滚动画框容器 */}
            <div
              ref={stageScrollRef}
              className={`relative overflow-auto rounded-[1.5rem] bg-[#fbf5f2]/40 flex justify-center ${
                fitMode === "fit"
                  ? "h-[calc(100vh-180px)] min-h-[500px] max-h-[820px] items-center"
                  : "h-[calc(100vh-180px)] min-h-[500px] max-h-[860px] items-start"
              }`}
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(183,110,121,0.3) transparent",
              }}
            >
              <div
                className="relative flex items-center justify-center p-2 sm:p-4 transition-transform duration-200"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                }}
              >
                <img
                  src={photo.src}
                  alt={photo.title || "相册原图"}
                  width={photo.width}
                  height={photo.height}
                  onClick={handleImageClick}
                  draggable={false}
                  className={`select-none rounded-[1.25rem] shadow-[0_16px_40px_rgba(95,75,82,0.12)] transition-all ${
                    zoom > 1
                      ? "cursor-zoom-out"
                      : "cursor-zoom-in"
                  } ${
                    fitMode === "fit"
                      ? "max-h-[calc(100vh-220px)] w-auto max-w-full object-contain"
                      : isPortrait
                      ? "w-full max-w-[820px] h-auto object-contain"
                      : "w-full max-w-[1050px] h-auto object-contain"
                  }`}
                  fetchPriority="high"
                  decoding="async"
                />
              </div>
            </div>
          </section>

          {/* 右侧：插画信息、工具栏与快捷操作 */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
            
            {/* 信息卡片 */}
            <div className="rounded-[1.75rem] border border-white/80 bg-white/70 p-5 sm:p-6 shadow-[0_20px_50px_rgba(95,75,82,0.1)] backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full bg-[#ff8fab]/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#b76e79]">
                  {isPortrait ? "竖屏插画" : "横屏壁纸"}
                </span>
                {index >= 0 ? (
                  <span className="font-mono text-xs font-bold tracking-wider text-[#5f4b52]/70">
                    #{String(index + 1).padStart(2, "0")}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-4 text-2xl font-black leading-tight text-[#241322] md:text-3xl">
                {photo.title || `Photo #${String(index + 1).padStart(2, "0")}`}
              </h1>

              <div className="mt-4 space-y-2 border-t border-[#5f4b52]/10 pt-4 text-xs text-[#5f4b52]">
                {hasSize ? (
                  <div className="flex items-center justify-between">
                    <span className="opacity-70">原始分辨率</span>
                    <span className="font-mono font-bold text-[#241322]">{photo.width} × {photo.height}</span>
                  </div>
                ) : null}
                {publishedAt ? (
                  <div className="flex items-center justify-between">
                    <span className="opacity-70">收录时间</span>
                    <span>{publishedAt}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* 交互工具箱卡片 */}
            <div className="rounded-[1.75rem] border border-white/80 bg-white/70 p-5 sm:p-6 shadow-[0_20px_50px_rgba(95,75,82,0.1)] backdrop-blur-xl flex flex-col gap-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#b76e79]">
                浏览控制
              </p>

              {/* 浏览模式切换：宽幅长卷 vs 窗口适应 */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#5f4b52]/8 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setFitMode("scroll");
                    setZoom(1);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    fitMode === "scroll"
                      ? "bg-white text-[#b76e79] shadow-sm"
                      : "text-[#5f4b52] hover:text-[#241322]"
                  }`}
                >
                  <FiMaximize className="text-xs" />
                  <span>宽幅长卷</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFitMode("fit");
                    setZoom(1);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    fitMode === "fit"
                      ? "bg-white text-[#b76e79] shadow-sm"
                      : "text-[#5f4b52] hover:text-[#241322]"
                  }`}
                >
                  <FiMinimize className="text-xs" />
                  <span>适应屏幕</span>
                </button>
              </div>

              {/* 无级缩放工具条 */}
              <div className="flex items-center justify-between rounded-2xl border border-white/90 bg-white/85 px-3 py-2 shadow-sm">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(0.75, Number((prev - 0.25).toFixed(2))))}
                  disabled={zoom <= 0.75}
                  title="缩小 (-)"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[#5f4b52] transition-colors hover:bg-[#ff8fab]/20 disabled:opacity-30"
                >
                  <FiZoomOut className="text-sm" />
                </button>

                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  title="复位 (0)"
                  className="text-xs font-mono font-bold text-[#5f4b52] hover:text-[#b76e79] transition-colors"
                >
                  {Math.round(zoom * 100)}%
                </button>

                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(3, Number((prev + 0.25).toFixed(2))))}
                  disabled={zoom >= 3}
                  title="放大 (+)"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[#5f4b52] transition-colors hover:bg-[#ff8fab]/20 disabled:opacity-30"
                >
                  <FiZoomIn className="text-sm" />
                </button>

                {zoom !== 1 && (
                  <button
                    type="button"
                    onClick={() => setZoom(1)}
                    title="重置"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[#5f4b52] hover:bg-[#ff8fab]/20 transition-colors"
                  >
                    <FiRotateCcw className="text-xs" />
                  </button>
                )}
              </div>

              {/* 原图直达与下载按钮 */}
              <a
                href={photo.src}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-2xl bg-[#ff8fab] py-3 text-xs font-bold uppercase tracking-[0.16em] text-white shadow-[0_12px_28px_rgba(255,143,171,0.35)] transition-all hover:bg-[#ff7aa0] hover:shadow-[0_14px_32px_rgba(255,143,171,0.45)]"
              >
                <span>新标签打开超清原图</span>
                <FiExternalLink className="text-sm" />
              </a>
            </div>

            {/* 键盘快捷键贴心提示 */}
            <div className="px-3 py-2 text-center text-[11px] text-[#5f4b52]/65">
              <span>快捷键：</span>
              <kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px]">←</kbd> /{" "}
              <kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px]">→</kbd> 翻页 ·{" "}
              <kbd className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd> 返回
            </div>

          </aside>
        </div>
      </main>
    </div>
  );
};

export default GalleryPhotoPage;

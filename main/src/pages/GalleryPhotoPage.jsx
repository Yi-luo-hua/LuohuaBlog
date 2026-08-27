import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { TiLocationArrow } from "react-icons/ti";
import { FiZoomIn, FiZoomOut, FiRotateCcw, FiExternalLink } from "react-icons/fi";
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

  // 缩放与拖拽查看状态
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, posX: 0, posY: 0 });
  const [hasDragged, setHasDragged] = useState(false);

  // 换照片时自动重置缩放与平移
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [photoId]);

  useEffect(() => {
    if (!photo) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (zoom > 1) {
          setZoom(1);
          setPosition({ x: 0, y: 0 });
        } else {
          navigate("/gallery");
        }
      }
      if (event.key === "+" || event.key === "=") {
        setZoom((prev) => Math.min(4, Number((prev + 0.5).toFixed(1))));
      }
      if (event.key === "-" || event.key === "_") {
        setZoom((prev) => {
          const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
          if (next === 1) setPosition({ x: 0, y: 0 });
          return next;
        });
      }
      if (event.key === "0") {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
      }
      if (zoom === 1) {
        if (event.key === "ArrowLeft" && previous) navigate(`/gallery/${previous.id}`);
        if (event.key === "ArrowRight" && next) navigate(`/gallery/${next.id}`);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photo, previous, next, navigate, zoom]);

  if (!photo) return <Navigate to="/gallery" replace />;

  const publishedAt = formatPublishedAt(photo.publishedAt);
  const hasSize = photo.width > 0 && photo.height > 0;

  const handleMouseDown = (e) => {
    if (zoom <= 1) return;
    setIsDragging(true);
    setHasDragged(false);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || zoom <= 1) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      setHasDragged(true);
    }
    setPosition({
      x: dragStart.posX + dx,
      y: dragStart.posY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleImageClick = () => {
    if (hasDragged) return;
    if (zoom === 1) {
      setZoom(2);
      setPosition({ x: 0, y: 0 });
    } else {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#fff8f1] pt-24 text-[#241322]">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(135deg,#fff8f1_0%,#ffeef5_48%,#f6fbff_100%)]"
        aria-hidden="true"
      />

      <header className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-5 pb-6 md:px-10">
        <Link
          to="/gallery"
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5f4b52] shadow-[0_14px_38px_rgba(95,75,82,0.12)] backdrop-blur-md transition-all hover:bg-white/85"
        >
          <TiLocationArrow className="rotate-180" />
          Gallery
        </Link>

        <div className="flex items-center gap-2">
          {previous ? (
            <Link
              to={`/gallery/${previous.id}`}
              className="rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5f4b52] backdrop-blur-md transition-all hover:bg-white/85"
            >
              上一张
            </Link>
          ) : null}
          {next ? (
            <Link
              to={`/gallery/${next.id}`}
              className="rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5f4b52] backdrop-blur-md transition-all hover:bg-white/85"
            >
              下一张
            </Link>
          ) : null}
        </div>
      </header>

      {/* 图片展示卡片：严格基于真实宽高比自适应收拢，杜绝任何比例下的空白大白边 */}
      <section className="container mx-auto flex items-center justify-center px-4 pb-8 md:px-10">
        <div
          className="relative inline-flex max-w-full items-center justify-center overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/60 p-2 shadow-[0_28px_80px_rgba(95,75,82,0.14)] backdrop-blur-xl sm:p-3"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-[1.25rem] select-none"
            style={
              hasSize
                ? {
                    aspectRatio: `${photo.width} / ${photo.height}`,
                    width: `min(100%, calc(74vh * ${photo.width} / ${photo.height}))`,
                    maxHeight: "74vh",
                    maxWidth: "100%",
                  }
                : {
                    maxHeight: "74vh",
                    maxWidth: "100%",
                  }
            }
          >
            <img
              src={photo.src}
              alt={photo.title || "相册原图"}
              width={photo.width}
              height={photo.height}
              onClick={handleImageClick}
              draggable={false}
              className={`h-full w-full select-none rounded-[1.25rem] object-contain transition-transform ${
                zoom > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
              }`}
              style={{
                transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                transformOrigin: "center center",
                transition: isDragging ? "none" : "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              fetchPriority="high"
              decoding="async"
            />

            {zoom > 1 && (
              <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-[11px] font-medium text-white shadow-lg backdrop-blur-md">
                按住拖拽平移 · 点击还原
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 底部信息与交互控制栏 */}
      <section className="container mx-auto flex flex-wrap items-end justify-between gap-6 px-5 pb-24 md:px-10">
        <div>
          <p className="font-general text-[10px] uppercase tracking-[0.36em] text-[#b76e79]">
            {index >= 0 ? `Photo ${String(index + 1).padStart(2, "0")}` : "Photo"}
            {hasSize ? ` · ${photo.width} × ${photo.height}` : ""}
          </p>
          {photo.title ? (
            <h1 className="mt-3 text-3xl font-black leading-tight md:text-4xl">{photo.title}</h1>
          ) : null}
          {publishedAt ? (
            <p className="mt-3 text-sm text-[#5f4b52]">发布于 {publishedAt}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 交互式缩放工具栏 */}
          <div className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/65 p-1 shadow-[0_8px_24px_rgba(95,75,82,0.08)] backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                setZoom((prev) => {
                  const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
                  if (next === 1) setPosition({ x: 0, y: 0 });
                  return next;
                });
              }}
              disabled={zoom <= 1}
              title="缩小 (-)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#5f4b52] transition-colors hover:bg-[#ff8fab]/20 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <FiZoomOut className="text-sm" />
            </button>

            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPosition({ x: 0, y: 0 });
              }}
              title="重置缩放 (0)"
              className="px-2 text-xs font-bold uppercase tracking-wider text-[#5f4b52] transition-colors hover:text-[#ff8fab]"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              type="button"
              onClick={() => {
                setZoom((prev) => Math.min(4, Number((prev + 0.5).toFixed(1))));
              }}
              disabled={zoom >= 4}
              title="放大 (+)"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#5f4b52] transition-colors hover:bg-[#ff8fab]/20 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <FiZoomIn className="text-sm" />
            </button>

            {zoom > 1 && (
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setPosition({ x: 0, y: 0 });
                }}
                title="适应窗口 (Esc)"
                className="flex h-8 w-8 items-center justify-center rounded-full text-[#5f4b52] transition-colors hover:bg-[#ff8fab]/20"
              >
                <FiRotateCcw className="text-xs" />
              </button>
            )}
          </div>

          <a
            href={photo.src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5f4b52] shadow-[0_8px_24px_rgba(95,75,82,0.08)] backdrop-blur-md transition-all hover:bg-white/85"
          >
            <span>新标签打开原图</span>
            <FiExternalLink className="text-xs" />
          </a>
        </div>
      </section>
    </div>
  );
};

export default GalleryPhotoPage;

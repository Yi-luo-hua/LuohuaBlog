import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { TiLocationArrow } from "react-icons/ti";
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
  const [actualSize, setActualSize] = useState(false);

  // 换一张图时收起“原始尺寸”，否则会带着上一张的缩放状态进来。
  useEffect(() => setActualSize(false), [photoId]);

  useEffect(() => {
    if (!photo) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") navigate("/gallery");
      if (event.key === "ArrowLeft" && previous) navigate(`/gallery/${previous.id}`);
      if (event.key === "ArrowRight" && next) navigate(`/gallery/${next.id}`);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [photo, previous, next, navigate]);

  if (!photo) return <Navigate to="/gallery" replace />;

  const publishedAt = formatPublishedAt(photo.publishedAt);
  const hasSize = photo.width > 0 && photo.height > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fff8f1] pt-24 text-[#241322]">
      <div
        className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(135deg,#fff8f1_0%,#ffeef5_48%,#f6fbff_100%)]"
        aria-hidden="true"
      />

      <header className="container mx-auto flex flex-wrap items-center justify-between gap-4 px-5 pb-6 md:px-10">
        <Link
          to="/gallery"
          className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5f4b52] shadow-[0_14px_38px_rgba(95,75,82,0.12)] backdrop-blur-md"
        >
          <TiLocationArrow className="rotate-180" />
          Gallery
        </Link>

        <div className="flex items-center gap-2">
          {previous ? (
            <Link
              to={`/gallery/${previous.id}`}
              className="rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5f4b52] backdrop-blur-md"
            >
              上一张
            </Link>
          ) : null}
          {next ? (
            <Link
              to={`/gallery/${next.id}`}
              className="rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5f4b52] backdrop-blur-md"
            >
              下一张
            </Link>
          ) : null}
        </div>
      </header>

      <section className="container mx-auto px-5 pb-10 md:px-10">
        <div
          className={`overflow-auto rounded-[1.75rem] border border-white/70 bg-white/50 p-3 shadow-[0_28px_90px_rgba(95,75,82,0.16)] ${
            actualSize ? "max-h-[82vh]" : ""
          }`}
        >
          <img
            src={photo.src}
            alt={photo.title || "相册原图"}
            width={photo.width}
            height={photo.height}
            className={
              actualSize
                ? "max-w-none rounded-[1.25rem]"
                : "mx-auto max-h-[78vh] w-auto max-w-full rounded-[1.25rem]"
            }
            style={actualSize && hasSize ? { width: photo.width, height: photo.height } : undefined}
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </section>

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

        <div className="flex flex-wrap items-center gap-2">
          {hasSize ? (
            <button
              type="button"
              onClick={() => setActualSize((current) => !current)}
              className="rounded-full bg-[#ff8fab] px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-white"
            >
              {actualSize ? "适应屏幕" : "原始尺寸"}
            </button>
          ) : null}
          <a
            href={photo.src}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-white/70 bg-white/65 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-[#5f4b52] backdrop-blur-md"
          >
            新标签打开原图
          </a>
        </div>
      </section>
    </div>
  );
};

export default GalleryPhotoPage;

import { useRef, useState } from "react";
import { TiLocationArrow } from "react-icons/ti";
import LazyVideo from "./LazyVideo";
import { FEATURED_PROJECT } from "../data/featuredProject.js";
import { cosAsset } from "../lib/cosAsset.js";

// 首页四张卡片原本铺的是模板作者的 feature-*.mp4，换成自己的图，一卡一张。
const BENTO = cosAsset("home");

export const ExhibitTilt = ({ children, className = "" }) => {
  const [transformStyle, setTransformStyle] = useState("");
  const itemRef = useRef(null);

  const handleMouseMove = (event) => {
    if (!itemRef.current) return;

    const { left, top, width, height } =
      itemRef.current.getBoundingClientRect();
    const relativeX = (event.clientX - left) / width;
    const relativeY = (event.clientY - top) / height;
    const tiltX = (relativeY - 0.5) * 4;
    const tiltY = (relativeX - 0.5) * -4;

    setTransformStyle(
      `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px) scale3d(.985, .985, .985)`,
    );
  };

  return (
    <div
      ref={itemRef}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTransformStyle("")}
      style={{ transform: transformStyle }}
    >
      {children}
    </div>
  );
};

// 卡片背景从模板作者的一批 mp4 换成了自己的图片，两种都要能放，
// 按扩展名分流即可，调用处依旧只传一个 src。
const IMAGE_SOURCE = /\.(avif|gif|jpe?g|png|webp)$/i;

const ExhibitBackdrop = ({ src, poster, priority, objectPosition }) =>
  IMAGE_SOURCE.test(String(src)) ? (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={`size-full object-cover ${objectPosition || ""}`}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  ) : (
    <LazyVideo src={src} poster={poster} priority={priority} />
  );

export const ExhibitCard = ({
  src,
  poster,
  index,
  label,
  title,
  description,
  linkUrl,
  linkText,
  videoPriority = false,
  visualOnly = false,
  objectPosition = "",
}) => {
  if (visualOnly) {
    return (
      <div className="group relative size-full overflow-hidden">
        <ExhibitBackdrop src={src} poster={poster} priority={videoPriority} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10" />
        {(label || index) && (
          <div className="pointer-events-none absolute left-5 top-5 rounded-full border border-white/20 bg-white/12 px-4 py-2 font-general text-[10px] uppercase tracking-[0.35em] text-blue-50/80 backdrop-blur-md">
            {label || `片段 ${index}`}
          </div>
        )}
      </div>
    );
  }

  const CardShell = linkUrl ? "a" : "div";
  const linkAttributes = linkUrl
    ? {
        href: linkUrl,
        "aria-label": `打开${title}`,
        ...(String(linkUrl).startsWith("http")
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {}),
      }
    : {};

  return (
    <CardShell
      className="group relative block size-full overflow-hidden focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#ff8fab]"
      {...linkAttributes}
    >
      <div className="absolute inset-0 z-0">
        <ExhibitBackdrop
          src={src}
          poster={poster}
          priority={videoPriority}
          objectPosition={objectPosition}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-black/20 via-black/5 to-[#160d14]/78" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-pink-100/60 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -left-1/3 top-0 z-10 h-full w-1/3 skew-x-[-18deg] bg-white/12 blur-xl transition duration-700 group-hover:left-full" />

      <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 text-blue-50 md:p-5">
        <div className="w-fit max-w-sm rounded-2xl border border-white/15 bg-black/42 px-3.5 py-2.5 shadow-[0_18px_58px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <p className="font-general text-[10px] uppercase tracking-[0.35em] text-pink-100/80">
            {label || `入口 ${index}`}
          </p>
          <h3 className="bento-title mt-2 break-words text-2xl font-black leading-none text-[#ffe7ef] md:text-4xl">
            {title}
          </h3>
          {description && (
            <p className="features-bento-card-copy mt-3 break-words text-sm font-semibold leading-relaxed text-white/90 md:text-base">
              {description}
            </p>
          )}
        </div>

        {linkUrl && (
          <span className="border-hsla relative flex w-fit items-center gap-2 overflow-hidden rounded-full bg-[#ffe7ef] px-5 py-2 text-xs font-bold text-[#241322] transition duration-300 group-hover:-translate-y-1 group-hover:bg-white">
            <span>{linkText}</span>
            <TiLocationArrow className="transition duration-300 group-hover:translate-x-1" />
          </span>
        )}
      </div>
    </CardShell>
  );
};

const Features = () => {
  return (
    <section
      id="features"
      className="bg-[linear-gradient(180deg,#fff8f1_0%,#ffeef5_46%,#f6fbff_100%)] pb-16 md:pb-52"
    >
      <div className="container mx-auto px-3 pt-8 md:px-10 md:pt-10">
        <ExhibitTilt className="border-hsla relative mb-7 h-96 w-full overflow-hidden rounded-[1.75rem] md:h-[65vh]">
          <ExhibitCard
            src="/media/feature-misaka-full-loop.mp4"
            poster="/media/feature-misaka-full-loop.webp"
            videoPriority
            visualOnly
          />
        </ExhibitTilt>

        <div className="features-bento-grid grid w-full grid-cols-1 gap-5 md:grid-cols-2 md:grid-rows-[16rem_16rem_18rem] md:gap-6 lg:grid-rows-[18rem_18rem_20rem]">
          <ExhibitTilt className="bento-tilt_1 h-72 rounded-[1.75rem] sm:h-80 md:col-span-1 md:row-span-2 md:h-auto">
            <ExhibitCard
              src={`${BENTO}/bento-bangumi.jpg`}
              label="动画收藏"
              title="番剧收藏"
              linkUrl="/bangumi"
              linkText="查看番剧"
            />
          </ExhibitTilt>

          <ExhibitTilt className="bento-tilt_1 h-72 rounded-[1.75rem] sm:h-80 md:col-span-1 md:h-auto">
            <ExhibitCard
              src={`${BENTO}/bento-gallery.jpg`}
              label="照片与生活"
              title="相册集"
              linkUrl="/gallery"
              linkText="打开相册"
            />
          </ExhibitTilt>

          <ExhibitTilt className="bento-tilt_1 h-72 rounded-[1.75rem] sm:h-80 md:col-span-1 md:h-auto">
            <ExhibitCard
              src={`${BENTO}/bento-about.jpg`}
              objectPosition="object-top"
              label="个人档案"
              title="关于我"
              linkUrl="/about"
              linkText="认识我"
            />
          </ExhibitTilt>

          <ExhibitTilt className="bento-tilt_2 h-72 rounded-[1.75rem] sm:h-80 md:col-span-2 md:h-auto">
            <ExhibitCard
              src={`${BENTO}/bento-project.jpg`}
              label="GitHub 项目"
              title={FEATURED_PROJECT.name}
              description={FEATURED_PROJECT.description}
              linkUrl={FEATURED_PROJECT.githubUrl}
              linkText="查看 GitHub"
            />
          </ExhibitTilt>
        </div>
      </div>
    </section>
  );
};

export default Features;

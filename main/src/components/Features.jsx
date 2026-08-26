import { useRef, useState } from "react";
import { TiLocationArrow } from "react-icons/ti";
import LazyVideo from "./LazyVideo";
import { FEATURED_PROJECT } from "../data/featuredProject.js";
import { cosAsset } from "../lib/cosAsset.js";

const COS = cosAsset(
  "AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main",
);

// 首页四张卡片原本铺的是模板作者的 feature-*.mp4，换成自己的图。
// 相册集和项目共用同一张超宽图——主体居中，两种宽高比裁下来都不伤画面。
const BENTO = cosAsset("home");

const ARCHIVE_ITEMS = [
  {
    index: "01",
    title: "开场影像",
    subtitle: "片段一",
    src: `${COS}/videos/feature-1.mp4`,
    note: "这一组影像里的第一枚碎片，被安静地留作开场。",
  },
  {
    index: "02",
    title: "碎片独处",
    subtitle: "进入花园",
    src: `${COS}/videos/feature-2.mp4`,
    note: "一个收纳日常念头、随手灵感与短暂心绪的温柔角落。",
    linkUrl: "/blog/",
    linkText: "进入花园",
  },
  {
    index: "03",
    title: "安静影像",
    subtitle: "片段四",
    src: `${COS}/videos/feature-4.mp4`,
    note: "一枚适合停下来多看一会儿的安静影像碎片。",
  },
  {
    index: "04",
    title: "新的收藏正在路上",
    subtitle: "待续",
    src: `${COS}/videos/feature-5.mp4`,
    note: "下一份值得收藏的内容，会在准备好之后来到这里。",
  },
];

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
        <div className="w-fit max-w-2xl rounded-2xl border border-white/15 bg-black/42 px-4 py-3 shadow-[0_18px_58px_rgba(0,0,0,0.25)] backdrop-blur-md">
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

const ArchiveBook = ({ open, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItem = ARCHIVE_ITEMS[activeIndex];

  if (!open) return null;

  const turnPage = (direction) => {
    setActiveIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return ARCHIVE_ITEMS.length - 1;
      if (next >= ARCHIVE_ITEMS.length) return 0;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[120] bg-[#120b10]/72 px-4 py-8 backdrop-blur-md md:px-10">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="关闭影像档案"
        onClick={onClose}
      />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center">
        <div className="mb-5 flex items-center justify-between text-blue-50">
          <p className="font-general text-xs uppercase tracking-[0.45em] text-pink-100/75">
            影像档案
          </p>
          <button
            type="button"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-50 backdrop-blur-md"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="relative min-h-[76vh] overflow-hidden rounded-[2rem] border border-[#f6d8c8]/60 bg-[linear-gradient(120deg,#fff8ef,#ffe9df)] shadow-[0_34px_120px_rgba(0,0,0,0.38)]">
          <div className="absolute left-1/2 top-0 h-full w-px bg-gradient-to-b from-transparent via-[#d8bba9] to-transparent opacity-70" />
          <div className="absolute inset-6 rounded-[1.5rem] border border-[#f4d5c8]/70" />

          <div className="grid h-full min-h-[76vh] md:grid-cols-[1.7fr_0.42fr]">
            <div className="relative flex items-center justify-center overflow-hidden p-3 md:p-5 [perspective:1600px]">
              <div className="absolute inset-5 rounded-[1.5rem] bg-[#241322]/5" />
              <div className="relative h-[62vh] w-full max-w-6xl [transform-style:preserve-3d]">
                {ARCHIVE_ITEMS.map((item, itemIndex) => {
                  const offset = itemIndex - activeIndex;
                  const absoluteOffset = Math.abs(offset);
                  const isActive = offset === 0;
                  const visible = absoluteOffset <= 1;

                  return (
                    <button
                      key={item.index}
                      type="button"
                      className={`absolute left-1/2 top-[47%] aspect-video w-[100%] max-w-[980px] overflow-hidden rounded-[1.6rem] border bg-[#241322] text-left shadow-[0_26px_80px_rgba(0,0,0,0.28)] transition duration-700 [transform-style:preserve-3d] ${
                        visible ? "pointer-events-auto" : "pointer-events-none"
                      }`}
                      style={{
                        zIndex: 50 - absoluteOffset,
                        opacity: isActive ? 1 : visible ? 0.42 : 0,
                        borderColor: isActive
                          ? "#ff8fab"
                          : "rgba(255,255,255,0.28)",
                        transform: `translate(-50%, -50%) translateX(${offset * 152}px) translateY(${absoluteOffset * 18}px) rotateY(${offset * -24}deg) rotateZ(${offset * 1.6}deg) scale(${1 - absoluteOffset * 0.12})`,
                      }}
                      onClick={() => setActiveIndex(itemIndex)}
                    >
                      <LazyVideo src={item.src} priority={isActive} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/10 to-white/10" />
                      <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-white/14 px-4 py-2 font-general text-[10px] uppercase tracking-[0.32em] text-blue-50/85 backdrop-blur-md">
                        档案卡 {item.index}
                      </div>
                      <div className="absolute bottom-5 left-5 right-5 text-blue-50">
                        <p className="font-general text-[10px] uppercase tracking-[0.32em] text-pink-100/80">
                          {item.subtitle}
                        </p>
                        <h3 className="mt-2 text-4xl font-black leading-none md:text-6xl">
                          {item.title}
                        </h3>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                className="absolute bottom-6 left-6 rounded-full border border-[#ead4bf] bg-white/75 px-5 py-2 text-sm font-bold text-[#241322] shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
                onClick={() => turnPage(-1)}
              >
                上一页
              </button>
              <button
                type="button"
                className="absolute bottom-6 right-6 rounded-full border border-[#ead4bf] bg-white/75 px-5 py-2 text-sm font-bold text-[#241322] shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
                onClick={() => turnPage(1)}
              >
                下一页
              </button>
            </div>

            <div className="relative flex flex-col justify-center border-t border-[#ead4bf] bg-white/46 p-5 md:border-l md:border-t-0 md:p-5">
              <p className="font-general text-[10px] uppercase tracking-[0.35em] text-[#b76e79]">
                当前片段
              </p>
              <h3 className="mt-4 text-4xl font-black leading-none text-[#241322] md:text-5xl">
                {activeItem.index}
              </h3>
              <h4 className="mt-4 text-2xl font-black leading-tight text-[#241322]">
                {activeItem.title}
              </h4>
              <p className="mt-2 text-sm uppercase tracking-[0.25em] text-[#8b6f63]">
                {activeItem.subtitle}
              </p>
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-[#5f4b52]">
                {activeItem.note}
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {ARCHIVE_ITEMS.map((item, itemIndex) => (
                  <button
                    key={item.index}
                    type="button"
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                      itemIndex === activeIndex
                        ? "border-[#ff8fab] bg-[#ff8fab] text-white"
                        : "border-[#ead4bf] bg-white/70 text-[#241322]"
                    }`}
                    onClick={() => setActiveIndex(itemIndex)}
                  >
                    {item.index}
                  </button>
                ))}
              </div>

              {activeItem.linkUrl && (
                <a
                  href={activeItem.linkUrl}
                  className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-[#241322] px-5 py-2 text-xs font-bold uppercase text-[#ffe7ef]"
                >
                  <TiLocationArrow />
                  {activeItem.linkText}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Features = () => {
  const [archiveOpen, setArchiveOpen] = useState(false);

  return (
    <section
      id="features"
      className="bg-[linear-gradient(180deg,#fff8f1_0%,#ffeef5_46%,#f6fbff_100%)] pb-16 md:pb-52"
    >
      <ArchiveBook open={archiveOpen} onClose={() => setArchiveOpen(false)} />

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
              description="正在追、已经看完与暂时搁置的动画，都按自己的节奏收进这面书架。"
              linkUrl="/bangumi"
              linkText="查看番剧"
            />
          </ExhibitTilt>

          <ExhibitTilt className="bento-tilt_1 h-72 rounded-[1.75rem] sm:h-80 md:col-span-1 md:h-auto">
            <ExhibitCard
              src={`${BENTO}/bento-wide.jpg`}
              label="照片与生活"
              title="相册集"
              description="收藏镜头里留下的风景、日常与心动瞬间，让每一张照片都有自己的位置。"
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
              description="关于伊洛华的故事、喜欢的事物与一路走来的小小轨迹，都放在这里。"
              linkUrl="/about"
              linkText="认识我"
            />
          </ExhibitTilt>

          <ExhibitTilt className="bento-tilt_2 h-72 rounded-[1.75rem] sm:h-80 md:col-span-2 md:h-auto">
            <ExhibitCard
              src={`${BENTO}/bento-wide.jpg`}
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

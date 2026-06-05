import { useRef, useState } from "react";
import { TiLocationArrow } from "react-icons/ti";
import LazyVideo from "./LazyVideo";

const COS =
  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main";

const ARCHIVE_ITEMS = [
  {
    index: "01",
    title: "Opening Visual",
    subtitle: "Feature One",
    src: `${COS}/videos/feature-1.mp4`,
    note: "The first visual fragment in this gallery, kept as a quiet opening scene.",
  },
  {
    index: "02",
    title: "Fragmented Solitude",
    subtitle: "Enter Garden",
    src: `${COS}/videos/feature-2.mp4`,
    note: "A gentle corner dedicated to casual thoughts, everyday whims, and transient sparks of inspiration.",
    linkUrl: "/blog/",
    linkText: "Enter Garden",
  },
  {
    index: "03",
    title: "The Chronicles of Creation",
    subtitle: "Access Lab",
    src: `${COS}/videos/feature-3.mp4`,
    note: "A minimalist sanctuary detailing full-stack engineering milestones, digital circuit layouts, and the architecture of hardware logic.",
    linkUrl: "/build/",
    linkText: "Access Lab",
  },
  {
    index: "04",
    title: "Quiet Visual",
    subtitle: "Feature Four",
    src: `${COS}/videos/feature-4.mp4`,
    note: "A quiet visual fragment kept for watching and staying for a moment.",
  },
  {
    index: "05",
    title: "More coming soon.",
    subtitle: "Feature Five",
    src: `${COS}/videos/feature-5.mp4`,
    note: "More coming soon.",
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
      `perspective(900px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px) scale3d(.985, .985, .985)`
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

export const ExhibitCard = ({
  src,
  index,
  title,
  description,
  linkUrl,
  linkText,
  videoPriority = false,
  visualOnly = false,
}) => {
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });
  const [hoverOpacity, setHoverOpacity] = useState(0);
  const hoverButtonRef = useRef(null);

  const handleMouseMove = (event) => {
    if (!hoverButtonRef.current) return;
    const rect = hoverButtonRef.current.getBoundingClientRect();

    setCursorPosition({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  };

  if (visualOnly) {
    return (
      <div className="group relative size-full overflow-hidden">
        <LazyVideo src={src} priority={videoPriority} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/10" />
        {index && (
          <div className="pointer-events-none absolute left-5 top-5 rounded-full border border-white/20 bg-white/12 px-4 py-2 font-general text-[10px] uppercase tracking-[0.35em] text-blue-50/80 backdrop-blur-md">
            Fragment {index}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group relative size-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <LazyVideo src={src} priority={videoPriority} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-black/20 via-black/5 to-[#160d14]/78" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-pink-100/60 to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute -left-1/3 top-0 z-10 h-full w-1/3 skew-x-[-18deg] bg-white/12 blur-xl transition duration-700 group-hover:left-full" />

      <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 text-blue-50 md:p-5">
        <div className="max-w-full rounded-2xl border border-white/15 bg-black/42 px-4 py-3 shadow-[0_18px_58px_rgba(0,0,0,0.25)] backdrop-blur-md">
          <p className="font-general text-[10px] uppercase tracking-[0.35em] text-pink-100/80">
            Fragment {index}
          </p>
          <h1 className="bento-title mt-2 break-words text-2xl font-black leading-none text-[#ffe7ef] md:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="features-bento-card-copy mt-3 break-words text-sm font-semibold leading-relaxed text-white/90 md:text-base">
              {description}
            </p>
          )}
        </div>

        {linkUrl && (
          <a
            className="w-fit"
            href={linkUrl}
            {...(String(linkUrl).startsWith("http")
              ? { target: "_blank", rel: "noopener noreferrer" }
              : {})}
          >
            <div
              ref={hoverButtonRef}
              onMouseMove={handleMouseMove}
              onMouseEnter={() => setHoverOpacity(1)}
              onMouseLeave={() => setHoverOpacity(0)}
              className="border-hsla relative flex w-fit cursor-pointer items-center gap-1 overflow-hidden rounded-full bg-[#ffe7ef] px-5 py-2 text-xs font-bold uppercase text-[#241322]"
            >
              <div
                className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
                style={{
                  opacity: hoverOpacity,
                  background: `radial-gradient(110px circle at ${cursorPosition.x}px ${cursorPosition.y}px, #ffffffcc, #ff9eb866)`,
                }}
              />
              <TiLocationArrow className="relative z-20" />
              <p className="relative z-20">{linkText}</p>
            </div>
          </a>
        )}
      </div>
    </div>
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
        aria-label="Close archive book"
        onClick={onClose}
      />

      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center">
        <div className="mb-5 flex items-center justify-between text-blue-50">
          <p className="font-general text-xs uppercase tracking-[0.45em] text-pink-100/75">
            Archive Book
          </p>
          <button
            type="button"
            className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-blue-50 backdrop-blur-md"
            onClick={onClose}
          >
            Close
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
                        Archive Card {item.index}
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
                Previous
              </button>
              <button
                type="button"
                className="absolute bottom-6 right-6 rounded-full border border-[#ead4bf] bg-white/75 px-5 py-2 text-sm font-bold text-[#241322] shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
                onClick={() => turnPage(1)}
              >
                Next
              </button>
            </div>

            <div className="relative flex flex-col justify-center border-t border-[#ead4bf] bg-white/46 p-5 md:border-l md:border-t-0 md:p-5">
              <p className="font-general text-[10px] uppercase tracking-[0.35em] text-[#b76e79]">
                Current Collection
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
    <section className="bg-[linear-gradient(180deg,#fff8f1_0%,#ffeef5_46%,#f6fbff_100%)] pb-16 md:pb-52">
      <ArchiveBook open={archiveOpen} onClose={() => setArchiveOpen(false)} />

      <div className="container mx-auto px-3 md:px-10">
        <div className="flex flex-col gap-8 px-5 py-32 text-[#241322] md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-general text-xs uppercase tracking-[0.45em] text-[#b76e79]">
              There will be three hidden surprises here
            </p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-[#5f4b52]">
              There will be three hidden surprises here
            </p>
          </div>

          <button
            type="button"
            className="archive-pass group relative w-full max-w-xs overflow-visible rounded-[1.5rem] border border-pink-100/30 bg-[#ffe7ef]/80 p-5 text-left text-[#241322] shadow-[0_18px_45px_rgba(255,143,171,0.18)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(255,143,171,0.24)] md:min-h-80 md:w-80 md:border-0 md:bg-transparent md:p-0 md:shadow-none"
            onClick={() => setArchiveOpen(true)}
          >
            <span className="archive-pass-bloom" aria-hidden="true">
              <span className="archive-pass-orbit" />
              <span className="archive-pass-ticket">
                <span className="archive-pass-spine" />
                <span className="archive-pass-stamp">05</span>
                <span className="archive-pass-rule archive-pass-rule-1" />
                <span className="archive-pass-rule archive-pass-rule-2" />
                <span className="archive-pass-rule archive-pass-rule-3" />
              </span>
              <span className="archive-pass-fragment archive-pass-fragment-1" />
              <span className="archive-pass-fragment archive-pass-fragment-2" />
              <span className="archive-pass-fragment archive-pass-fragment-3" />
              <span className="archive-pass-fragment archive-pass-fragment-4" />
              <span className="archive-pass-fragment archive-pass-fragment-5" />
              <span className="archive-pass-thread" />
            </span>
            <span className="absolute -right-10 -top-10 size-28 rounded-full bg-white/55 blur-2xl md:hidden" />
            <span className="absolute inset-x-5 top-4 h-px bg-gradient-to-r from-transparent via-[#b76e79]/35 to-transparent md:hidden" />
            <span className="archive-pass-content relative z-10 block font-general text-[10px] uppercase tracking-[0.35em] text-[#b76e79] md:absolute md:inset-x-8 md:top-[4.2rem] md:text-center">
              Archive Pass
            </span>
            <span className="relative z-10 mt-4 block text-3xl font-black leading-none tracking-[-0.04em] text-[#261320] md:absolute md:inset-x-8 md:top-[5.8rem] md:mt-0 md:text-center md:text-[2.35rem]">
              5 Fragments
            </span>
            <span className="relative z-10 mt-2 block text-sm font-semibold leading-relaxed text-[#5f4b52] md:absolute md:inset-x-9 md:top-[9.45rem] md:mt-0 md:text-center">
              Open the archive book to revisit these visual fragments.
            </span>
            <span className="relative z-10 mt-5 inline-flex items-center gap-2 rounded-full bg-[#241322] px-4 py-2 text-xs font-bold uppercase text-[#ffe7ef] md:absolute md:bottom-9 md:left-1/2 md:mt-0 md:-translate-x-1/2">
              View Archive
              <TiLocationArrow />
            </span>
            <span className="absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-18deg] bg-white/45 blur-md transition duration-700 group-hover:left-full md:hidden" />
          </button>
        </div>

        <ExhibitTilt className="border-hsla relative mb-7 h-96 w-full overflow-hidden rounded-[1.75rem] md:h-[65vh]">
          <ExhibitCard
            src={`${COS}/videos/feature-1.mp4`}
            index="01"
            videoPriority
            visualOnly
          />
        </ExhibitTilt>

        <div className="features-bento-grid grid h-[135vh] w-full grid-cols-2 grid-rows-3 gap-7">
          <ExhibitTilt className="bento-tilt_1 row-span-1 rounded-[1.75rem] md:col-span-1 md:row-span-2">
            <ExhibitCard
              src={`${COS}/videos/feature-2.mp4`}
              index="02"
              title={
                <>
                  Frag<b>m</b>ented Solitude
                </>
              }
              description="A gentle corner dedicated to casual thoughts, everyday whims, and transient sparks of inspiration. Whispering stories to the wind, captured in the warmth of passing days."
              linkUrl="/blog/"
              linkText="Enter Garden"
            />
          </ExhibitTilt>

          <ExhibitTilt className="bento-tilt_1 row-span-1 rounded-[1.75rem] ms-32 md:col-span-1 md:ms-0">
            <ExhibitCard
              src={`${COS}/videos/feature-3.mp4`}
              index="03"
              title={
                <>
                  The Chr<b>o</b>nicles of Creation
                </>
              }
              description="A minimalist sanctuary detailing full-stack engineering milestones, digital circuit layouts, and the architecture of hardware logic. Where wild ideas shape into reality, code by code."
              linkUrl="/build/"
              linkText="Access Lab"
            />
          </ExhibitTilt>

          <ExhibitTilt className="bento-tilt_1 rounded-[1.75rem] me-14 md:col-span-1 md:me-0">
            <ExhibitCard
              src={`${COS}/videos/feature-4.mp4`}
              index="04"
              visualOnly
            />
          </ExhibitTilt>

          <ExhibitTilt className="bento-tilt_2 rounded-[1.75rem]">
            <div className="relative flex size-full flex-col justify-between overflow-hidden bg-[#ffe7ef] p-5 text-[#241322]">
              <div className="absolute -right-14 -top-14 size-40 rounded-full bg-white/55 blur-2xl" />
              <p className="font-general text-[10px] uppercase tracking-[0.35em] text-[#b76e79]">
                Fragment 05
              </p>
              <h1 className="bento-title max-w-72 text-3xl font-black leading-none md:text-5xl">
                M<b>o</b>re co<b>m</b>ing s<b>o</b>on.
              </h1>
              <TiLocationArrow className="m-5 scale-[5] self-end text-[#ff8fab]" />
            </div>
          </ExhibitTilt>

          <ExhibitTilt className="bento-tilt_2 rounded-[1.75rem]">
            <ExhibitCard
              src={`${COS}/videos/feature-5.mp4`}
              index="06"
              visualOnly
            />
          </ExhibitTilt>
        </div>
      </div>
    </section>
  );
};

export default Features;

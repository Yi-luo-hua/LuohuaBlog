import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/all";
import { TiLocationArrow } from "react-icons/ti";
import { useEffect, useRef, useState } from "react";

import Button from "./Button";
import { areHeroImagesReady, isHeroImageReady } from "./heroImageState";

gsap.registerPlugin(ScrollTrigger);

const TOTAL_HERO_IMAGES = 4;
const HERO_INDEXES = Array.from(
  { length: TOTAL_HERO_IMAGES },
  (_, index) => index + 1
);
const COS = `https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main`;
const getImgSrc = (index) => `${COS}/img/hero-${index}.webp`;
const HERO_CARD_FOCUS = {
  1: "50% 50%",
  2: "50% 50%",
  3: "50% 50%",
  4: "50% 50%",
};
const HERO_COMPASS_THEMES = {
  1: {
    accent: "#DDE8FF",
    line: "rgba(221, 232, 255, 0.42)",
    soft: "rgba(132, 180, 255, 0.16)",
    glow: "rgba(170, 205, 255, 0.2)",
    overlay: "rgba(7, 11, 22, 0.66)",
  },
  2: {
    accent: "#FFE7B8",
    line: "rgba(255, 231, 184, 0.44)",
    soft: "rgba(255, 202, 128, 0.15)",
    glow: "rgba(255, 221, 170, 0.2)",
    overlay: "rgba(18, 12, 18, 0.64)",
  },
  3: {
    accent: "#F7D8FF",
    line: "rgba(247, 216, 255, 0.44)",
    soft: "rgba(214, 165, 255, 0.15)",
    glow: "rgba(235, 202, 255, 0.2)",
    overlay: "rgba(14, 10, 24, 0.64)",
  },
  4: {
    accent: "#D9FFF3",
    line: "rgba(217, 255, 243, 0.44)",
    soft: "rgba(144, 232, 214, 0.15)",
    glow: "rgba(184, 255, 239, 0.2)",
    overlay: "rgba(6, 16, 18, 0.64)",
  },
};
const HERO_COMPASS_ITEMS = [
  {
    index: 1,
    direction: "N",
    label: "North",
    angle: 0,
  },
  {
    index: 2,
    direction: "E",
    label: "East",
    angle: 90,
  },
  {
    index: 3,
    direction: "S",
    label: "South",
    angle: 180,
  },
  {
    index: 4,
    direction: "W",
    label: "West",
    angle: 270,
  },
];
const COMPASS_TICKS = 32;
const COMPASS_DIRECTIONS = [
  { direction: "N", label: "North" },
  { direction: "E", label: "East" },
  { direction: "S", label: "South" },
  { direction: "W", label: "West" },
];

const normalizeAngle = (angle) => ((angle % 360) + 360) % 360;
const getCompassDirection = (angle) =>
  COMPASS_DIRECTIONS[Math.round(normalizeAngle(angle) / 90) % 4];

const Hero = () => {
  const [currentIndex, setCurrentIndex] = useState(1);
  const [previousIndex, setPreviousIndex] = useState(1);
  const [hasClicked, setHasClicked] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadedHeroIndexes, setLoadedHeroIndexes] = useState(() => new Set());
  const compassTheme = HERO_COMPASS_THEMES[currentIndex];
  const [compassRotation, setCompassRotation] = useState(0);
  const compassRef = useRef(null);
  const compassDragRef = useRef(null);

  useEffect(() => {
    const handler = () => {
      setCompassRotation(0);
      setSelectorOpen(true);
    };
    window.addEventListener("showHeroPreview", handler);
    return () => {
      window.removeEventListener("showHeroPreview", handler);
    };
  }, []);

  const markHeroImageLoaded = (index) => {
    setLoadedHeroIndexes((prev) => {
      if (prev.has(index)) return prev;
      return new Set([...prev, index]);
    });
  };

  useEffect(() => {
    if (areHeroImagesReady([1, 2], loadedHeroIndexes)) {
      setLoading(false);
    }
  }, [loadedHeroIndexes]);

  useEffect(() => {
    let cancelled = false;
    HERO_INDEXES.forEach((index) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setLoadedHeroIndexes((prev) => {
          if (prev.has(index)) return prev;
          return new Set([...prev, index]);
        });
      };
      img.src = getImgSrc(index);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectorOpen) return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectorOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectorOpen]);

  const selectHeroImage = (nextIndex) => {
    if (!isHeroImageReady(nextIndex, loadedHeroIndexes)) return;
    setSelectorOpen(false);
    if (nextIndex === currentIndex) return;
    setPreviousIndex(currentIndex);
    setHasClicked(true);
    setIsTransitioning(true);
    setCurrentIndex(nextIndex);
  };

  const getCompassPointerAngle = (event) => {
    if (!compassRef.current) return 0;
    const rect = compassRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    return (
      (Math.atan2(event.clientY - centerY, event.clientX - centerX) * 180) /
        Math.PI +
      90
    );
  };

  const handleCompassPointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    compassDragRef.current = {
      pointerId: event.pointerId,
      offset: getCompassPointerAngle(event) - compassRotation,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCompassPointerMove = (event) => {
    if (!compassDragRef.current) return;
    setCompassRotation(
      getCompassPointerAngle(event) - compassDragRef.current.offset
    );
  };

  const handleCompassPointerUp = (event) => {
    if (compassDragRef.current?.pointerId === event.pointerId) {
      compassDragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  useGSAP(
    () => {
      if (hasClicked) {
        gsap.set("#previous-image", {
          autoAlpha: 1,
          filter: "blur(0px) brightness(1)",
          scale: 1,
        });
        gsap.set("#bg-image", {
          transformOrigin: "center center",
          scale: 1.055,
          filter: "blur(10px) brightness(1.08)",
        });
        gsap.set("#hero-transition-wash", {
          autoAlpha: 0,
          xPercent: -42,
          scaleX: 0.55,
        });

        gsap
          .timeline({
            onComplete: () => setIsTransitioning(false),
          })
          .to(
            "#previous-image",
            {
              autoAlpha: 0,
              scale: 1.035,
              filter: "blur(14px) brightness(0.88)",
              duration: 1.05,
              ease: "power2.out",
            },
            0
          )
          .to(
            "#bg-image",
            {
              scale: 1,
              filter: "blur(0px) brightness(1)",
              duration: 1.28,
              ease: "power3.inOut",
            },
            0
          )
          .to(
            "#hero-transition-wash",
            {
              autoAlpha: 0.32,
              xPercent: -6,
              scaleX: 1,
              duration: 0.48,
              ease: "power2.out",
            },
            0.04
          )
          .to(
            "#hero-transition-wash",
            {
              autoAlpha: 0,
              xPercent: 38,
              scaleX: 1.25,
              duration: 0.72,
              ease: "power3.inOut",
            },
            0.45
          );
      }
    },
    {
      dependencies: [currentIndex],
      revertOnUpdate: true,
    }
  );

  useGSAP(() => {
    gsap.set("#video-frame", {
      clipPath: "polygon(14% 0, 72% 0, 88% 90%, 0 95%)",
      borderRadius: "0% 0% 40% 10%",
    });
    gsap.from("#video-frame", {
      clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
      borderRadius: "0% 0% 0% 0%",
      ease: "power1.inOut",
      scrollTrigger: {
        trigger: "#video-frame",
        start: "center center",
        end: "bottom center",
        scrub: true,
      },
    });
  });

  return (
    <div className="relative h-dvh w-screen overflow-x-hidden">
      {loading && (
        <div className="flex-center absolute z-[100] h-dvh w-screen overflow-hidden bg-violet-50">
          <div className="three-body">
            <div className="three-body__dot"></div>
            <div className="three-body__dot"></div>
            <div className="three-body__dot"></div>
          </div>
        </div>
      )}

      <div
        id="video-frame"
        className="relative z-10 h-dvh w-screen overflow-hidden rounded-lg bg-blue-75"
      >
        <div>
          {isTransitioning && (
            <img
              src={getImgSrc(previousIndex)}
              id="previous-image"
              className="pointer-events-none absolute left-0 top-0 z-30 size-full object-cover object-center"
              onLoad={() => markHeroImageLoaded(previousIndex)}
            />
          )}
          <img
            src={getImgSrc(currentIndex)}
            id="bg-image"
            className="absolute left-0 top-0 size-full object-cover object-center"
            onLoad={() => markHeroImageLoaded(currentIndex)}
            fetchPriority="high"
          />
        </div>

        <div
          id="hero-transition-wash"
          className="pointer-events-none absolute inset-y-0 left-1/2 z-[35] hidden w-[42vw] -translate-x-1/2 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.1),rgba(190,220,255,0.12),rgba(255,255,255,0.08),transparent)] opacity-0 blur-2xl mix-blend-screen md:block"
        />

        {selectorOpen && (
          <div
            className="absolute inset-0 z-50 hidden px-8 py-20 backdrop-blur-xl md:block"
            style={{
              background: `linear-gradient(135deg, rgba(255,249,252,0.78), ${compassTheme.overlay})`,
            }}
          >
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              aria-label="Close hero card selector"
              onClick={() => setSelectorOpen(false)}
            />
            <div className="pointer-events-none relative z-10 mx-auto h-full max-w-7xl [perspective:1400px]">
              <p className="absolute left-0 top-0 font-general text-xs uppercase tracking-[0.45em] text-[#4c5365]/75">
                Choose Hero Compass
              </p>

              <div
                className="absolute left-1/2 top-1/2 h-px w-[78%] -translate-x-1/2 bg-gradient-to-r from-transparent to-transparent"
                style={{
                  backgroundImage: `linear-gradient(90deg, transparent, ${compassTheme.line}, transparent)`,
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-[78%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent to-transparent"
                style={{
                  backgroundImage: `linear-gradient(180deg, transparent, ${compassTheme.line}, transparent)`,
                }}
              />

              <div
                ref={compassRef}
                className="pointer-events-auto absolute left-1/2 top-1/2 flex size-72 -translate-x-1/2 -translate-y-1/2 touch-none select-none items-center justify-center overflow-visible rounded-full border bg-white/10 shadow-[0_24px_90px_rgba(255,182,202,0.24)] backdrop-blur-xl cursor-grab active:cursor-grabbing"
                onPointerDown={handleCompassPointerDown}
                onPointerMove={handleCompassPointerMove}
                onPointerUp={handleCompassPointerUp}
                onPointerCancel={handleCompassPointerUp}
                style={{
                  borderColor: compassTheme.line,
                  background: `radial-gradient(circle, rgba(255,255,255,0.86), ${compassTheme.soft} 46%, rgba(255,246,250,0.66) 72%)`,
                  boxShadow: `0 28px 110px ${compassTheme.glow}`,
                }}
              >
                <div className="absolute inset-0 rounded-full bg-white/20" />
                <div
                  className="absolute inset-12 overflow-hidden rounded-full border bg-white/55 shadow-[0_18px_58px_rgba(0,0,0,0.18)]"
                  style={{ borderColor: compassTheme.line }}
                >
                  <img
                    src="/img/compass-avatar.jpg"
                    alt="桃之夭夭头像罗盘"
                    className="size-full object-cover"
                    style={{ objectPosition: "50% 43%" }}
                    draggable="false"
                  />
                  <div className="absolute inset-0 bg-white/8" />
                </div>
                <div
                  className="absolute inset-4 rounded-full border"
                  style={{
                    borderColor: compassTheme.line,
                    transform: `rotate(${compassRotation}deg)`,
                  }}
                >
                  {Array.from({ length: COMPASS_TICKS }, (_, tick) => (
                    <span
                      key={tick}
                      className={`absolute left-1/2 top-1/2 block origin-[50%_0] -translate-x-1/2 ${
                        tick % 4 === 0 ? "h-5 w-px" : "h-2.5 w-px opacity-55"
                      }`}
                      style={{
                        backgroundColor: compassTheme.accent,
                        transform: `translateX(-50%) rotate(${tick * (360 / COMPASS_TICKS)}deg) translateY(-124px)`,
                      }}
                    />
                  ))}
                </div>

                <div
                  className="absolute inset-10 rounded-full border"
                  style={{
                    borderColor: compassTheme.line,
                    background: `conic-gradient(from 0deg, transparent, ${compassTheme.soft}, transparent, ${compassTheme.glow}, transparent)`,
                    transform: `rotate(${-compassRotation * 0.45}deg)`,
                  }}
                />

                <div
                  className="absolute inset-16 rounded-full border bg-black/20"
                  style={{
                    borderColor: compassTheme.line,
                    boxShadow: `inset 0 0 34px ${compassTheme.glow}`,
                  }}
                />

                <div
                  className="absolute h-px w-[118%]"
                  style={{
                    backgroundImage: `linear-gradient(90deg, transparent, ${compassTheme.line}, transparent)`,
                  }}
                />
                <div
                  className="absolute h-[118%] w-px"
                  style={{
                    backgroundImage: `linear-gradient(180deg, transparent, ${compassTheme.line}, transparent)`,
                  }}
                />
                <div
                  className="absolute size-24 rotate-45 border-l border-t"
                  style={{ borderColor: compassTheme.line }}
                />
                <div
                  className="absolute size-16 -rotate-45 border-l border-t"
                  style={{ borderColor: compassTheme.accent }}
                />

                <div
                  className="absolute bottom-8 rounded-full border px-4 py-1 font-general text-[9px] uppercase tracking-[0.28em] text-[#3e4352]"
                  style={{
                    borderColor: compassTheme.line,
                    backgroundColor: "rgba(255,255,255,0.74)",
                  }}
                >
                  DRAG
                </div>

                <span
                  className="absolute -top-8 font-general text-sm font-bold"
                  style={{ color: compassTheme.accent }}
                >
                  N
                </span>
                <span
                  className="absolute -right-8 font-general text-sm font-bold"
                  style={{ color: compassTheme.accent }}
                >
                  E
                </span>
                <span
                  className="absolute -bottom-8 font-general text-sm font-bold"
                  style={{ color: compassTheme.accent }}
                >
                  S
                </span>
                <span
                  className="absolute -left-8 font-general text-sm font-bold"
                  style={{ color: compassTheme.accent }}
                >
                  W
                </span>
              </div>

              <p
                className="absolute left-1/2 top-[calc(50%+10rem)] -translate-x-1/2 rounded-full border px-5 py-2 font-general text-xs uppercase tracking-[0.28em] shadow-[0_14px_40px_rgba(255,182,202,0.18)] backdrop-blur-md"
                style={{
                  borderColor: compassTheme.line,
                  backgroundColor: "rgba(255,255,255,0.72)",
                  color: "#3e4352",
                }}
              >
                转动指南针有惊喜
              </p>

              <div className="pointer-events-none absolute inset-0">
                {HERO_COMPASS_ITEMS.map((item) => {
                  const index = item.index;
                  const ready = isHeroImageReady(index, loadedHeroIndexes);
                  const active = index === currentIndex;
                  const orbitAngle = item.angle + compassRotation;
                  const movingDirection = getCompassDirection(orbitAngle);
                  return (
                    <div
                      key={index}
                      className="pointer-events-auto absolute left-1/2 top-1/2"
                      style={{
                        transform: `translate(-50%, -50%) rotate(${orbitAngle}deg) translateY(-31vh) rotate(${-orbitAngle}deg)`,
                      }}
                    >
                        <button
                          type="button"
                          disabled={!ready}
                          onClick={() => selectHeroImage(index)}
                          className={`group relative aspect-video w-[27vw] max-w-[340px] min-w-[230px] overflow-hidden rounded-[1.5rem] border bg-white/70 text-left shadow-[0_28px_80px_rgba(255,182,202,0.2)] transition duration-500 [transform-style:preserve-3d] hover:-translate-y-3 hover:scale-[1.025] ${
                            ready ? "cursor-pointer" : "cursor-wait opacity-60"
                          }`}
                          style={{
                            borderColor: active
                              ? compassTheme.accent
                              : "rgba(255,255,255,0.2)",
                          }}
                        >
                      <img
                        src={getImgSrc(index)}
                        alt={`Hero scene ${index}`}
                          className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-105"
                        style={{ objectPosition: HERO_CARD_FOCUS[index] }}
                        onLoad={() => markHeroImageLoaded(index)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/18 to-white/10" />
                      <div
                        className="absolute left-4 top-4 rounded-full border bg-white/70 px-3 py-1 font-general text-[10px] uppercase tracking-[0.25em] backdrop-blur-sm"
                        style={{
                          borderColor: compassTheme.line,
                          color: compassTheme.accent,
                        }}
                      >
                        {movingDirection.direction}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-5 text-blue-50">
                        <p className="font-general text-[10px] uppercase tracking-[0.35em] text-blue-75/85">
                          {movingDirection.label}
                        </p>
                        <p className="mt-2 text-4xl font-black leading-none">
                          0{index}
                        </p>
                        <p
                          className="mt-3 text-xs uppercase tracking-[0.25em]"
                          style={{ color: compassTheme.accent }}
                        >
                          {active ? "Current" : ready ? "Select" : "Loading"}
                        </p>
                      </div>
                        </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <h1 className="special-font hero-heading absolute bottom-5 right-5 z-40 text-blue-75">
          桃之<b>夭</b>夭
        </h1>

        <div className="absolute left-0 top-0 z-40 size-full">
          <div className="mt-24 px-5 sm:px-10">
            <h1 className="special-font hero-heading text-blue-100">
              WELCOME
            </h1>

            <p className="mb-5 max-w-64 font-robert-regular text-blue-100">
              This is only the beginning
            </p>

            <div className="flex items-center gap-4">
              <div onClick={() => setShowScrollHint(true)}>
                <Button
                  id="explore"
                  title="EXPLORE"
                  leftIcon={<TiLocationArrow />}
                  containerClass="bg-yellow-300 flex-center gap-1 cursor-pointer"
                />
              </div>
              {showScrollHint && (
                <span className="text-sm md:text-base font-circular-web text-blue-75/85 tracking-[0.3em] animate-pulse">
                  ↓ 下滑探索
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <h1 className="special-font hero-heading absolute bottom-5 right-5 text-black">
        桃之<b>夭</b>夭
      </h1>
    </div>
  );
};

export default Hero;

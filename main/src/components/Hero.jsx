import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/all";
import { TiLocationArrow } from "react-icons/ti";
import { useEffect, useRef, useState } from "react";

import Button from "./Button";
import VideoPreview from "./VideoPreview";

gsap.registerPlugin(ScrollTrigger);

const Hero = () => {
  const [currentIndex, setCurrentIndex] = useState(1);
  const [hasClicked, setHasClicked] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const previewTimerRef = useRef(null);

  useEffect(() => {
    const handler = () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
      setPreviewVisible(true);
      previewTimerRef.current = setTimeout(() => setPreviewVisible(false), 1000);
    };
    window.addEventListener("showHeroPreview", handler);
    return () => {
      window.removeEventListener("showHeroPreview", handler);
    };
  }, []);

  const [loading, setLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState(0);

  const totalImages = 4;

  const handleImageLoad = () => {
    setLoadedImages((prev) => prev + 1);
  };

  useEffect(() => {
    if (loadedImages >= totalImages - 1) {
      setLoading(false);
    }
  }, [loadedImages]);

  const handleMiniClick = () => {
    setHasClicked(true);
    setCurrentIndex((prevIndex) => (prevIndex % totalImages) + 1);
  };

  useGSAP(
    () => {
      if (hasClicked) {
        gsap.set("#next-image", { visibility: "visible" });
        gsap.to("#next-image", {
          transformOrigin: "center center",
          scale: 1,
          width: "100%",
          height: "100%",
          duration: 1,
          ease: "power1.inOut",
        });
        gsap.from("#current-image", {
          transformOrigin: "center center",
          scale: 0,
          duration: 1.5,
          ease: "power1.inOut",
        });
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

  const getImgSrc = (index) => `img/hero-${index}.webp`;

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
          <div className="mask-clip-path absolute-center absolute z-50 size-64 cursor-pointer overflow-hidden rounded-lg hidden md:block">
            <VideoPreview>
              <div
                onClick={handleMiniClick}
                className={`origin-center transition-all duration-700 ease-out hover:scale-100 hover:opacity-100 ${previewVisible ? "scale-90 opacity-90" : "scale-50 opacity-0"}`}
              >
                <img
                  src={getImgSrc((currentIndex % totalImages) + 1)}
                  id="current-image"
                  className="size-64 origin-center scale-150 object-cover object-center"
                  onLoad={handleImageLoad}
                />
              </div>
            </VideoPreview>
          </div>

          <img
            src={getImgSrc(currentIndex)}
            id="next-image"
            className="absolute-center invisible absolute z-20 size-64 object-cover object-center hidden md:block"
            onLoad={handleImageLoad}
          />
          <img
            src={getImgSrc(
              currentIndex === totalImages - 1 ? 1 : currentIndex
            )}
            id="bg-image"
            className="absolute left-0 top-0 size-full object-cover object-center"
            onLoad={handleImageLoad}
            fetchpriority="high"
          />
        </div>

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

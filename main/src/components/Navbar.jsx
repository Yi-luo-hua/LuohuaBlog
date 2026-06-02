import clsx from "clsx";
import gsap from "gsap";
import { useWindowScroll } from "react-use";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
const navLinks = [
  { label: "About", to: "/#about" },
  { label: "Contact", to: "/#contact" },
  { label: "END", to: "/#end" },
  { label: "Bili Hub", to: "/bili", end: true },
];

const NavBar = () => {
  const { pathname } = useLocation();
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isIndicatorActive, setIsIndicatorActive] = useState(false);

  const audioElementRef = useRef(null);
  const navContainerRef = useRef(null);

  const { y: currentScrollY } = useWindowScroll();
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const toggleAudioIndicator = () => {
    setIsAudioPlaying((prev) => !prev);
    setIsIndicatorActive((prev) => !prev);
  };

  useEffect(() => {
    if (isAudioPlaying) {
      audioElementRef.current.play();
    } else {
      audioElementRef.current.pause();
    }
  }, [isAudioPlaying]);

  useEffect(() => {
    if (currentScrollY === 0) {
      setIsNavVisible(true);
      navContainerRef.current.classList.remove("floating-nav");
    } else if (currentScrollY > lastScrollY) {
      setIsNavVisible(false);
      navContainerRef.current.classList.add("floating-nav");
    } else if (currentScrollY < lastScrollY) {
      setIsNavVisible(true);
      navContainerRef.current.classList.add("floating-nav");
    }

    setLastScrollY(currentScrollY);
  }, [currentScrollY, lastScrollY]);

  useEffect(() => {
    gsap.to(navContainerRef.current, {
      y: isNavVisible ? 0 : -100,
      opacity: isNavVisible ? 1 : 0,
      duration: 0.2,
    });
  }, [isNavVisible]);

  const isBiliPage = pathname === "/bili" || pathname.startsWith("/bili/");
  return (
    <div
      ref={navContainerRef}
      className="fixed inset-x-0 top-2 z-50 h-14 border-none transition-all duration-700 sm:inset-x-4 sm:top-4 sm:h-16 md:inset-x-6"
    >
      <header className="absolute top-1/2 w-full -translate-y-1/2">
        <nav className="flex size-full min-w-0 items-center justify-between gap-2 px-2 sm:gap-3 sm:p-4">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-7">
            <Link to="/" className="block shrink-0" aria-label="Home">
              <img
                src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/img/logo.png"
                alt="logo"
                className="h-8 w-8 sm:h-10 sm:w-10"
              />
            </Link>
            {currentScrollY === 0 && !isBiliPage && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("showHeroPreview"))}
                className="nav-hover-btn hidden md:inline"
              >
                CHANGE
              </button>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end">
            <div className="flex max-w-full flex-nowrap items-center justify-end overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {navLinks.map((item) => {
                const active = item.to === "/bili" && isBiliPage;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={clsx("nav-hover-btn", {
                      "text-yellow-300": active,
                    })}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <button
              onClick={toggleAudioIndicator}
              className="ml-1 flex shrink-0 items-center space-x-0.5 sm:ml-3 md:ml-6"
              type="button"
              aria-label="Toggle background music"
            >
              <audio
                ref={audioElementRef}
                className="hidden"
                src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/audio/loop.mp3"
                loop
              />
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={clsx("indicator-line", {
                    active: isIndicatorActive,
                  })}
                  style={{
                    animationDelay: `${bar * 0.1}s`,
                  }}
                />
              ))}
            </button>
          </div>
        </nav>
      </header>
    </div>
  );
};

export default NavBar;

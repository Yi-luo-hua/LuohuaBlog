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
  { label: "AI 流量", to: "/ai-traffic", end: true },
];

const NavBar = () => {
  const { pathname } = useLocation();
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isIndicatorActive, setIsIndicatorActive] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const audioElementRef = useRef(null);
  const navContainerRef = useRef(null);
  const headerRef = useRef(null);

  const { y: currentScrollY } = useWindowScroll();
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const isBiliPage = pathname === "/bili" || pathname.startsWith("/bili/");
  const isAiTrafficPage =
    pathname === "/ai-traffic" || pathname.startsWith("/ai-traffic/");
  const isSubPage = isBiliPage || isAiTrafficPage;
  const isLightNav = isSubPage;

  const toggleAudioIndicator = () => {
    setIsAudioPlaying((prev) => !prev);
    setIsIndicatorActive((prev) => !prev);
  };

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onDoc = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [mobileOpen]);

  useEffect(() => {
    if (isAudioPlaying) {
      audioElementRef.current?.play();
    } else {
      audioElementRef.current?.pause();
    }
  }, [isAudioPlaying]);

  useEffect(() => {
    if (!navContainerRef.current) return;
    if (currentScrollY === 0) {
      setIsNavVisible(true);
      navContainerRef.current.classList.remove("floating-nav", "floating-nav-light");
    } else if (currentScrollY > lastScrollY) {
      setIsNavVisible(false);
      if (isLightNav) {
        navContainerRef.current.classList.add("floating-nav-light");
        navContainerRef.current.classList.remove("floating-nav");
      } else {
        navContainerRef.current.classList.add("floating-nav");
        navContainerRef.current.classList.remove("floating-nav-light");
      }
    } else if (currentScrollY < lastScrollY) {
      setIsNavVisible(true);
      if (isLightNav) {
        navContainerRef.current.classList.add("floating-nav-light");
        navContainerRef.current.classList.remove("floating-nav");
      } else {
        navContainerRef.current.classList.add("floating-nav");
        navContainerRef.current.classList.remove("floating-nav-light");
      }
    }

    setLastScrollY(currentScrollY);
  }, [currentScrollY, lastScrollY, isLightNav]);

  useEffect(() => {
    gsap.to(navContainerRef.current, {
      y: isNavVisible ? 0 : -100,
      opacity: isNavVisible ? 1 : 0,
      duration: 0.2,
    });
  }, [isNavVisible]);

  const linkClass = (active) =>
    clsx("nav-hover-btn", isLightNav && "nav-hover-btn-light", {
      "text-[#FF8FAB]": active && isLightNav,
      "text-yellow-300": active && !isLightNav,
    });

  const renderNavLink = (item, onNavigate) => {
    const active =
      (item.to === "/bili" && isBiliPage) ||
      (item.to === "/ai-traffic" && isAiTrafficPage);
    return (
      <Link
        key={item.label}
        to={item.to}
        className={linkClass(active)}
        onClick={onNavigate}
      >
        {item.label}
      </Link>
    );
  };

  return (
    <div
      ref={navContainerRef}
      className={clsx(
        "fixed inset-x-0 top-2 z-50 h-14 border-none transition-all duration-700 sm:inset-x-4 sm:top-4 sm:h-16 md:inset-x-6",
        isLightNav && currentScrollY === 0 && "floating-nav-light"
      )}
    >
      <header
        ref={headerRef}
        className="absolute top-1/2 w-full -translate-y-1/2"
      >
        <nav className="relative flex size-full min-w-0 items-center justify-between gap-2 px-2 sm:gap-3 sm:p-4">
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-7">
            <Link to="/" className="block shrink-0" aria-label="Home">
              <img
                src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/img/logo.png"
                alt="logo"
                className="h-8 w-8 sm:h-10 sm:w-10"
              />
            </Link>
            {currentScrollY === 0 && !isSubPage && (
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("showHeroPreview"))
                }
                className={clsx(
                  "nav-hover-btn hidden md:inline",
                  isLightNav && "nav-hover-btn-light"
                )}
              >
                CHANGE
              </button>
            )}
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 sm:gap-2">
            <div className="hidden max-w-full flex-nowrap items-center justify-end md:flex">
              {navLinks.map((item) => renderNavLink(item))}
            </div>

            <button
              type="button"
              className={clsx(
                "relative flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border md:hidden",
                isLightNav
                  ? "border-[#F2E6C9] bg-white/90 text-[#2B2B2B]"
                  : "border-white/20 bg-black/40 text-blue-50"
              )}
              aria-label={mobileOpen ? "关闭导航菜单" : "打开导航菜单"}
              aria-expanded={mobileOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMobileOpen((o) => !o);
              }}
            >
              <span
                className={clsx(
                  "block h-0.5 w-5 rounded-full bg-current transition-transform duration-200",
                  mobileOpen && "translate-y-2 rotate-45"
                )}
              />
              <span
                className={clsx(
                  "block h-0.5 w-5 rounded-full bg-current transition-opacity duration-200",
                  mobileOpen && "opacity-0"
                )}
              />
              <span
                className={clsx(
                  "block h-0.5 w-5 rounded-full bg-current transition-transform duration-200",
                  mobileOpen && "-translate-y-2 -rotate-45"
                )}
              />
            </button>

            <button
              onClick={toggleAudioIndicator}
              className="ml-0.5 flex shrink-0 items-center space-x-0.5 sm:ml-2 md:ml-4"
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
                    "indicator-line-light": isLightNav,
                  })}
                  style={{
                    animationDelay: `${bar * 0.1}s`,
                  }}
                />
              ))}
            </button>
          </div>

          {mobileOpen && (
            <div
              className={clsx(
                "absolute right-2 top-[calc(100%+8px)] z-[60] flex w-[min(100%,280px)] flex-col gap-1 rounded-2xl border p-3 shadow-[0_12px_30px_rgba(255,143,171,0.18)] md:hidden",
                isLightNav
                  ? "border-[#F2E6C9] bg-white"
                  : "border-white/15 bg-neutral-900"
              )}
            >
              {navLinks.map((item) =>
                renderNavLink(item, () => setMobileOpen(false))
              )}
            </div>
          )}
        </nav>
      </header>
    </div>
  );
};

export default NavBar;

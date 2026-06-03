import clsx from "clsx";
import gsap from "gsap";
import { useWindowScroll } from "react-use";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";

const navLinks = [
  { label: "About", to: "/#about" },
  { label: "Contact", to: "/#contact" },
  { label: "END", to: "/#end" },
  { label: "Bili Hub", to: "/bili", end: true },
  { label: "AI 流量", to: "/ai-traffic", end: true },
];

const DRAWER_MS = 220;

const NavBar = () => {
  const { pathname } = useLocation();
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isIndicatorActive, setIsIndicatorActive] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const audioElementRef = useRef(null);
  const navContainerRef = useRef(null);
  const menuBtnRef = useRef(null);
  const closeBtnRef = useRef(null);
  const drawerRef = useRef(null);

  const { y: currentScrollY } = useWindowScroll();
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const isBiliPage = pathname === "/bili" || pathname.startsWith("/bili/");
  const isAiTrafficPage =
    pathname === "/ai-traffic" || pathname.startsWith("/ai-traffic/");
  const isSubPage = isBiliPage || isAiTrafficPage;
  const isLightNav = isSubPage;

  const closeMobile = useCallback(() => {
    setDrawerVisible(false);
    menuBtnRef.current?.focus();
    window.setTimeout(() => {
      setMobileOpen(false);
      setDrawerMounted(false);
      document.body.style.overflow = "";
    }, DRAWER_MS);
  }, []);

  const openMobile = useCallback(() => {
    setMobileOpen(true);
    setDrawerMounted(true);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setDrawerVisible(true));
    });
  }, []);

  const toggleAudioIndicator = () => {
    setIsAudioPlaying((prev) => !prev);
    setIsIndicatorActive((prev) => !prev);
  };

  useEffect(() => {
    setDrawerVisible(false);
    setMobileOpen(false);
    setDrawerMounted(false);
    document.body.style.overflow = "";
  }, [pathname]);

  useEffect(() => {
    if (!drawerMounted) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerMounted, closeMobile]);

  useEffect(() => {
    if (!drawerVisible) return;
    const id = window.setTimeout(() => closeBtnRef.current?.focus(), 40);
    return () => window.clearTimeout(id);
  }, [drawerVisible]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

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

  const desktopLinkClass = (active) =>
    clsx("nav-hover-btn", isLightNav && "nav-hover-btn-light", {
      "text-[#FF8FAB]": active && isLightNav,
      "text-yellow-300": active && !isLightNav,
    });

  const isLinkActive = (item) =>
    (item.to === "/bili" && isBiliPage) ||
    (item.to === "/ai-traffic" && isAiTrafficPage);

  const renderDesktopLink = (item) => (
    <Link
      key={item.label}
      to={item.to}
      className={desktopLinkClass(isLinkActive(item))}
    >
      {item.label}
    </Link>
  );

  const renderMobileLink = (item) => {
    const active = isLinkActive(item);
    return (
      <Link
        key={item.label}
        to={item.to}
        className={clsx(
          "nav-mobile-link",
          isLightNav ? "nav-mobile-link--light" : "nav-mobile-link--dark",
          active &&
            (isLightNav
              ? "nav-mobile-link--active-light"
              : "nav-mobile-link--active-dark")
        )}
        onClick={closeMobile}
      >
        {item.label}
      </Link>
    );
  };

  const drawerTheme = isLightNav ? "light" : "dark";

  const mobileDrawer =
    drawerMounted &&
    createPortal(
      <div className="nav-mobile-root md:hidden" aria-hidden={!drawerVisible}>
        <button
          type="button"
          className={clsx(
            "nav-mobile-backdrop",
            `nav-mobile-backdrop--${drawerTheme}`,
            drawerVisible && "is-open"
          )}
          aria-label="关闭导航菜单"
          tabIndex={drawerVisible ? 0 : -1}
          onClick={closeMobile}
        />
        <div
          ref={drawerRef}
          id="site-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="站点导航"
          aria-hidden={!drawerVisible}
          className={clsx(
            "nav-mobile-drawer",
            `nav-mobile-drawer--${drawerTheme}`,
            drawerVisible && "is-open"
          )}
        >
          <div className="nav-mobile-drawer-head">
            <span className="nav-mobile-drawer-title">菜单</span>
            <button
              ref={closeBtnRef}
              type="button"
              className="nav-mobile-close"
              aria-label="关闭菜单"
              onClick={closeMobile}
            >
              <span aria-hidden>×</span>
            </button>
          </div>
          <nav className="nav-mobile-links">
            {navLinks.map((item) => renderMobileLink(item))}
          </nav>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <div
        ref={navContainerRef}
        className={clsx(
          "fixed inset-x-0 top-2 z-50 h-14 border-none transition-all duration-700 sm:inset-x-4 sm:top-4 sm:h-16 md:inset-x-6",
          isLightNav && currentScrollY === 0 && "floating-nav-light"
        )}
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
              <div className="hidden items-center justify-end md:flex">
                {navLinks.map((item) => renderDesktopLink(item))}
              </div>

              <button
                ref={menuBtnRef}
                type="button"
                className={clsx(
                  "nav-menu-btn md:hidden",
                  isLightNav && "nav-menu-btn--light"
                )}
                aria-label="打开导航菜单"
                aria-expanded={mobileOpen}
                aria-controls="site-mobile-nav"
                onClick={openMobile}
              >
                <span className="nav-menu-btn-bar" />
                <span className="nav-menu-btn-bar" />
                <span className="nav-menu-btn-bar" />
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
          </nav>
        </header>
      </div>
      {mobileDrawer}
    </>
  );
};

export default NavBar;

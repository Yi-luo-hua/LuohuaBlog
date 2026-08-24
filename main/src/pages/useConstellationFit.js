import { useEffect } from "react";

const DESKTOP_QUERY = "(min-width: 1200px)";
// Shrinking past this makes the bubble copy unreadable, so a very short window
// scrolls a little instead of collapsing the whole constellation.
const MINIMUM_SCALE = 0.68;
// A roomy screen grows the board instead of leaving it marooned in whitespace.
const MAXIMUM_SCALE = 1.25;
const BOTTOM_BREATHING_ROOM = 6;

const readPixels = (value) => Number.parseFloat(value) || 0;

// The footer paints tooltips slightly below its own box, so reserve what it
// actually covers instead of just its height.
const measureFooterReach = (footer) => {
  if (!footer) return 0;
  const box = footer.getBoundingClientRect();
  let bottom = box.bottom;
  footer.querySelectorAll("*").forEach((child) => {
    const childBox = child.getBoundingClientRect();
    if (childBox.height) bottom = Math.max(bottom, childBox.bottom);
  });
  return Math.ceil(bottom - box.top);
};

/**
 * Measures how much room the about constellation actually has and publishes the
 * matching shrink factor as `--about-fit`, so the desktop layout fits on one
 * screen without a scrollbar.
 */
export const useConstellationFit = (pageRef, gridRef) => {
  useEffect(() => {
    const page = pageRef.current;
    const grid = gridRef.current;
    if (!page || !grid) return undefined;

    const desktopMedia = window.matchMedia(DESKTOP_QUERY);
    let frame = 0;
    let settleTimer = 0;

    const measure = () => {
      if (!desktopMedia.matches) {
        page.style.removeProperty("--about-fit");
        page.style.removeProperty("--about-footer");
        return;
      }

      // offsetHeight ignores the scale we apply, so this stays the design height.
      const designHeight = grid.offsetHeight;
      if (!designHeight) return;

      const pageStyle = window.getComputedStyle(page);
      const pageTop = page.getBoundingClientRect().top + window.scrollY;
      const footer = (page.parentElement || document).querySelector("footer");
      const footerHeight = measureFooterReach(footer);
      const availableHeight =
        window.innerHeight -
        pageTop -
        readPixels(pageStyle.paddingTop) -
        readPixels(pageStyle.paddingBottom) -
        footerHeight -
        BOTTOM_BREATHING_ROOM;
      // The grid's layout width is capped by the design, so once the window is
      // wider than that there is spare room to grow into.
      const availableWidth =
        page.clientWidth -
        readPixels(pageStyle.paddingLeft) -
        readPixels(pageStyle.paddingRight);

      const fit = Math.min(
        MAXIMUM_SCALE,
        Math.max(
          MINIMUM_SCALE,
          Math.min(availableWidth / grid.offsetWidth, availableHeight / designHeight),
        ),
      );
      // The page fills the viewport by itself, so it has to give the footer its
      // height back or the footer is pushed below the fold no matter how small
      // the constellation gets.
      page.style.setProperty("--about-footer", `${footerHeight}px`);
      page.style.setProperty("--about-fit", String(Math.round(fit * 1000) / 1000));
    };

    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    // Measured synchronously so the very first paint is already scaled, and so a
    // tab opened in the background (where rAF never fires) still gets a fit.
    measure();
    // Late fonts and cover images can still move the footer, so re-measure once.
    settleTimer = window.setTimeout(measure, 600);
    window.addEventListener("resize", schedule);
    desktopMedia.addEventListener("change", schedule);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("resize", schedule);
      desktopMedia.removeEventListener("change", schedule);
      page.style.removeProperty("--about-fit");
      page.style.removeProperty("--about-footer");
    };
  }, [pageRef, gridRef]);
};

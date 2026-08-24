import { useEffect, useRef, useState } from "react";

import { getHeroWordmarkStyle } from "./heroWordmarkTheme";
import {
  YI_LUO_HUA_WORDMARK_PATHS,
  YI_LUO_HUA_WORDMARK_TRANSFORM,
  YI_LUO_HUA_WORDMARK_VIEWBOX,
} from "./heroWordmarkGlyphs";

const WORDMARK_LABEL = "Yi-luo-hua";
const GLYPH_DRAW_DURATION = 0.6;
const GLYPH_STAGGER = 0.24;

const getGlyphStyle = (index, length) => ({
  "--len": length || 1,
  "--dur": `${GLYPH_DRAW_DURATION}s`,
  "--delay": `${index * GLYPH_STAGGER}s`,
  strokeDasharray: length || 1,
  strokeDashoffset: length || 1,
  stroke: "url(#hero-wordmark-stroke-gradient)",
  fill: "url(#hero-wordmark-fill-gradient)",
});

const HeroWordmark = ({ heroIndex }) => {
  const svgRef = useRef(null);
  const [pathLengths, setPathLengths] = useState([]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    setPathLengths([]);
    const lengths = [...svg.querySelectorAll(".hero-wordmark-glyph")].map(
      (path) => path.getTotalLength(),
    );
    setPathLengths(lengths);
  }, [heroIndex]);

  const isReady = pathLengths.length === YI_LUO_HUA_WORDMARK_PATHS.length;

  return (
    <div
      key={`hero-wordmark-${heroIndex}`}
      className={
        isReady ? "hero-wordmark hero-wordmark--ready" : "hero-wordmark"
      }
      style={getHeroWordmarkStyle(heroIndex)}
      aria-label={WORDMARK_LABEL}
    >
      <svg
        ref={svgRef}
        className="hero-wordmark-svg"
        viewBox={YI_LUO_HUA_WORDMARK_VIEWBOX}
        role="img"
        aria-labelledby="hero-wordmark-title"
      >
        <title id="hero-wordmark-title">{WORDMARK_LABEL}</title>
        <defs>
          <linearGradient
            id="hero-wordmark-stroke-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="10%"
          >
            <stop offset="0%" stopColor="var(--hero-wordmark-stroke)" />
            <stop offset="52%" stopColor="var(--hero-wordmark-stroke-mid)" />
            <stop offset="100%" stopColor="var(--hero-wordmark-stroke-end)" />
          </linearGradient>
          <linearGradient
            id="hero-wordmark-fill-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="12%"
          >
            <stop offset="0%" stopColor="var(--hero-wordmark-fill)" />
            <stop offset="58%" stopColor="var(--hero-wordmark-fill-mid)" />
            <stop offset="100%" stopColor="var(--hero-wordmark-fill-end)" />
          </linearGradient>
        </defs>
        <g transform={YI_LUO_HUA_WORDMARK_TRANSFORM}>
          {YI_LUO_HUA_WORDMARK_PATHS.map((path, index) => (
            <path
              key={`${path.char}-${index}`}
              className="hero-wordmark-glyph hero-wordmark-stroke-path hero-wordmark-fill-after"
              d={path.d}
              style={getGlyphStyle(index, pathLengths[index])}
            />
          ))}
        </g>
      </svg>
    </div>
  );
};

export default HeroWordmark;

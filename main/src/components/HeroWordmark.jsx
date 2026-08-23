import { getHeroWordmarkStyle } from "./heroWordmarkTheme";

const HeroWordmark = ({ heroIndex }) => (
  <div
    key={`hero-wordmark-${heroIndex}`}
    className="hero-wordmark hero-wordmark--ready"
    style={getHeroWordmarkStyle(heroIndex)}
    aria-label="Yi-luo-hua"
  >
    <svg
      className="hero-wordmark-svg"
      viewBox="0 0 420 180"
      role="img"
      aria-labelledby="hero-wordmark-title"
    >
      <title id="hero-wordmark-title">Yi-luo-hua</title>
      <defs>
        <linearGradient
          id="hero-wordmark-fill-gradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="15%"
        >
          <stop offset="0%" stopColor="var(--hero-wordmark-fill)" />
          <stop offset="58%" stopColor="var(--hero-wordmark-fill-mid)" />
          <stop offset="100%" stopColor="var(--hero-wordmark-fill-end)" />
        </linearGradient>
      </defs>
      <text
        className="hero-wordmark-text"
        x="210"
        y="122"
        textAnchor="middle"
      >
        Yi-luo-hua
      </text>
    </svg>
  </div>
);

export default HeroWordmark;

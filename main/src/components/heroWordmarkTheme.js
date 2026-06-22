export const HERO_WORDMARK_THEMES = {
  1: {
    name: "peach-gold",
    stroke: "rgba(255, 250, 242, 0.96)",
    strokeMid: "rgba(255, 232, 190, 0.94)",
    strokeEnd: "rgba(255, 255, 255, 0.9)",
    fill: "rgba(255, 250, 242, 0.74)",
    fillMid: "rgba(255, 226, 168, 0.56)",
    fillEnd: "rgba(255, 255, 255, 0.5)",
    glow: "rgba(247, 210, 124, 0.76)",
    veil: "rgba(38, 18, 26, 0.18)",
  },
  2: {
    name: "moon-blue",
    stroke: "rgba(255, 250, 242, 0.96)",
    strokeMid: "rgba(226, 244, 255, 0.94)",
    strokeEnd: "rgba(255, 255, 255, 0.9)",
    fill: "rgba(255, 250, 242, 0.74)",
    fillMid: "rgba(234, 245, 255, 0.56)",
    fillEnd: "rgba(255, 255, 255, 0.5)",
    glow: "rgba(234, 245, 255, 0.72)",
    veil: "rgba(7, 16, 34, 0.2)",
  },
  3: {
    name: "star-violet",
    stroke: "rgba(255, 250, 242, 0.96)",
    strokeMid: "rgba(250, 231, 255, 0.94)",
    strokeEnd: "rgba(255, 255, 255, 0.9)",
    fill: "rgba(255, 250, 242, 0.74)",
    fillMid: "rgba(245, 232, 255, 0.56)",
    fillEnd: "rgba(255, 255, 255, 0.5)",
    glow: "rgba(245, 232, 255, 0.74)",
    veil: "rgba(18, 10, 34, 0.2)",
  },
  4: {
    name: "rain-mint",
    stroke: "rgba(255, 250, 242, 0.96)",
    strokeMid: "rgba(224, 255, 246, 0.94)",
    strokeEnd: "rgba(255, 255, 255, 0.9)",
    fill: "rgba(255, 250, 242, 0.74)",
    fillMid: "rgba(214, 255, 240, 0.58)",
    fillEnd: "rgba(255, 255, 255, 0.5)",
    glow: "rgba(214, 255, 240, 0.76)",
    veil: "rgba(6, 20, 18, 0.2)",
  },
};

export const getHeroWordmarkTheme = (index) => {
  // 主题颜色循环偏移一位：1→2, 2→3, 3→4, 4→1
  // 让 wordmark 显示"下一封面"的颜色，营造预告/呼应感
  const shifted = ((index - 1 + 1) % 4) + 1;
  return HERO_WORDMARK_THEMES[shifted] || HERO_WORDMARK_THEMES[1];
};

export const getHeroWordmarkStyle = (index) => {
  const theme = getHeroWordmarkTheme(index);
  return {
    "--hero-wordmark-stroke": theme.stroke,
    "--hero-wordmark-stroke-mid": theme.strokeMid,
    "--hero-wordmark-stroke-end": theme.strokeEnd,
    "--hero-wordmark-fill": theme.fill,
    "--hero-wordmark-fill-mid": theme.fillMid,
    "--hero-wordmark-fill-end": theme.fillEnd,
    "--hero-wordmark-glow": theme.glow,
    "--hero-wordmark-veil": theme.veil,
  };
};

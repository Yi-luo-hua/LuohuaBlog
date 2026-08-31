// 播放器的强调色。固定一个淡蓝，不再从封面取色——每首歌一个颜色看着就是
// 廉价配色，页面的颜色统一交给背景那张画去出，界面本身只负责中性灰阶。
// 强调色只用在三个地方：当前曲的文字、进度条填充、主按钮。
export const PLAYER_ACCENT = { h: 205, s: 62, l: 66 };

const hashHue = (text) => {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 360;
  }
  return hash;
};

// 无封面占位块的底色。极低饱和，只是让列表里的占位彼此不完全一样，
// 不参与"强调色"的角色。
export const trackTint = (id) => ({ h: id ? hashHue(id) : 258, s: 16, l: 30 });

// 强调色 -> CSS 变量。播放器所有组件都只读这几个变量。
export const accentVars = ({ h, s, l } = PLAYER_ACCENT) => ({
  "--accent": `hsl(${h} ${s}% ${l}%)`,
  "--accent-deep": `hsl(${h} ${Math.min(s + 10, 64)}% ${Math.max(l - 14, 34)}%)`,
  "--accent-soft": `hsl(${h} ${s}% ${l}% / 0.14)`,
  "--accent-glow": `hsl(${h} ${s}% ${l}% / 0.28)`,
  // 强调色够亮时，压在它上面的图标/文字要翻成深色才压得住
  "--accent-ink": l > 63 ? "#0c1016" : "#ffffff",
});

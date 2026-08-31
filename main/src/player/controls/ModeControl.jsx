import { FiList, FiRepeat, FiRotateCcw, FiShuffle } from "react-icons/fi";
import {
  MUSIC_MODE_LABELS,
  MUSIC_PLAY_MODES,
} from "../MusicPlayerProvider.jsx";
import IconButton from "./IconButton.jsx";

// 图标映射只此一份。原来 MiniPlayerBar 和 MusicPage 各抄了一遍，改一个模式
// 要改两处。
const MODE_ICONS = {
  order: FiList,
  repeat: FiRepeat,
  shuffle: FiShuffle,
  one: FiRotateCcw,
};

// segmented：四个模式全铺开，一眼看清当前在哪（桌面）。
// cycle：一个按钮轮着切（窄屏与浮窗）。
const ModeControl = ({ mode, onCycle, onSelect, variant = "cycle", className = "" }) => {
  if (variant === "segmented") {
    return (
      <div
        className={`flex items-center gap-0.5 rounded-full border border-[color:var(--player-line)] p-0.5 ${className}`}
        role="group"
        aria-label="播放模式"
      >
        {MUSIC_PLAY_MODES.map((playMode) => (
          <IconButton
            key={playMode}
            icon={MODE_ICONS[playMode]}
            label={MUSIC_MODE_LABELS[playMode]}
            onClick={() => onSelect(playMode)}
            active={mode === playMode}
            size={30}
            iconSize={15}
            className={mode === playMode ? "bg-[color:var(--accent-soft)]" : ""}
          />
        ))}
      </div>
    );
  }

  const Icon = MODE_ICONS[mode] || FiRepeat;
  // className 交给外面这层 span：.player-icon-btn 自带 display:grid，和
  // Tailwind 的 lg:hidden 权重相同，谁赢取决于两份 CSS 的注入顺序，不能赌。
  return (
    <span className={`inline-flex ${className}`}>
      <IconButton
        icon={Icon}
        label={`播放模式：${MUSIC_MODE_LABELS[mode]}`}
        title={MUSIC_MODE_LABELS[mode]}
        onClick={onCycle}
        size={32}
        iconSize={17}
      />
    </span>
  );
};

export default ModeControl;

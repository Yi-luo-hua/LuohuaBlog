import { FiPause, FiPlay } from "react-icons/fi";

// 主按钮。busy 时外圈转一圈：自托管的 flac 体积不小，从点下去到出声之间
// 原来是一段"图标已经变成暂停但没有声音"的空窗，这里给它一个交代。
const PlayPauseButton = ({
  isPlaying,
  busy = false,
  onClick,
  disabled = false,
  size = 48,
  iconSize = 20,
  label,
}) => {
  const Icon = isPlaying ? FiPause : FiPlay;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label ?? (isPlaying ? "暂停" : "播放")}
      title={isPlaying ? "暂停" : "播放"}
      data-busy={busy ? "true" : undefined}
      className="player-play-btn"
      style={{ width: size, height: size }}
    >
      <Icon
        aria-hidden="true"
        style={{
          width: iconSize,
          height: iconSize,
          // 三角形的视觉重心偏左，往右挪一点才像居中
          transform: isPlaying ? undefined : "translateX(1px)",
        }}
      />
    </button>
  );
};

export default PlayPauseButton;

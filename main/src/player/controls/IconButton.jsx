// 播放器里所有次要按钮（上一首/下一首/模式/静音/更多）的唯一实现。
// 尺寸由 size 给，配色一律读 player.css 里的 --player-* 与 --accent，
// 所以同一个按钮放进深色歌单页和浅色关于页卡片都不用改样式。
const IconButton = ({
  icon: Icon,
  label,
  onClick,
  active = false,
  disabled = false,
  size = 36,
  iconSize = 18,
  className = "",
  title,
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    aria-pressed={active || undefined}
    title={title ?? label}
    data-active={active ? "true" : undefined}
    className={`player-icon-btn ${className}`}
    style={{ width: size, height: size }}
  >
    <Icon style={{ width: iconSize, height: iconSize }} aria-hidden="true" />
  </button>
);

export default IconButton;

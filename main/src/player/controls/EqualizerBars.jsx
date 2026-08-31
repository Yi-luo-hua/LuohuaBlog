// 列表里"正在播放"那一行用它替掉序号。
// 高度写在 .player-eq span 上：父级 align-items:flex-end 会取消 flex 默认的
// stretch，空 span 不给高度就是 0——旧版三根条在页面上完全看不见就是这个原因。
const EqualizerBars = ({ bars = 3, onAccent = false, className = "" }) => (
  <span
    className={`player-eq ${className}`}
    data-on-accent={onAccent ? "true" : undefined}
    aria-hidden="true"
  >
    {Array.from({ length: bars }, (_, index) => (
      <span
        key={index}
        style={{ animationDelay: `${index * 0.16}s` }}
      />
    ))}
  </span>
);

export default EqualizerBars;

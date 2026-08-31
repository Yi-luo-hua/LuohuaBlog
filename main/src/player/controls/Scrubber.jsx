import { useCallback, useEffect, useRef, useState } from "react";
import { formatTime } from "../../lib/formatTime.js";

// 进度条。拖动期间用本地值接管显示，松手才 seek——旧版三处都把 currentTime
// 直接当受控 value、onChange 立刻 seek，缓冲一慢滑块就会被 4Hz 的 timeupdate
// 拽回去，手感是断的。
const Scrubber = ({
  currentTime,
  duration,
  onSeek,
  disabled = false,
  showTimes = true,
  thickness = 4,
  className = "",
  label = "播放进度",
}) => {
  const [dragValue, setDragValue] = useState(null);
  const draggingRef = useRef(false);
  const latestRef = useRef(0);
  const pendingRef = useRef(null);
  const releaseTimerRef = useRef(0);

  const max = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const value = dragValue ?? Math.min(currentTime, max);
  const fill = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  // seek 之后 currentTime 要等下一次 timeupdate 才追上来，那一帧会把滑块
  // 弹回旧位置。等真实进度靠拢到提交点，或超时兜底，才交还控制权。
  useEffect(() => {
    if (pendingRef.current === null) return;
    if (Math.abs(currentTime - pendingRef.current) < 0.75) {
      pendingRef.current = null;
      setDragValue(null);
    }
  }, [currentTime]);

  useEffect(() => () => window.clearTimeout(releaseTimerRef.current), []);

  const commit = useCallback(
    (next) => {
      draggingRef.current = false;
      pendingRef.current = next;
      onSeek(next);
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = window.setTimeout(() => {
        pendingRef.current = null;
        setDragValue(null);
      }, 1200);
    },
    [onSeek],
  );

  const handleChange = (event) => {
    const next = Number(event.target.value);
    latestRef.current = next;
    setDragValue(next);
    // 键盘方向键不会走 pointerdown，这类改动即时生效。
    if (!draggingRef.current) commit(next);
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {showTimes ? (
        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-[color:var(--player-muted)]">
          {formatTime(value)}
        </span>
      ) : null}
      <input
        type="range"
        min="0"
        max={max || 1}
        step="0.1"
        value={value}
        disabled={disabled || max === 0}
        onChange={handleChange}
        onPointerDown={() => {
          draggingRef.current = true;
        }}
        onPointerUp={() => {
          if (draggingRef.current) commit(latestRef.current);
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
          setDragValue(null);
        }}
        aria-label={label}
        aria-valuetext={`${formatTime(value)} / ${formatTime(max)}`}
        data-dragging={dragValue !== null ? "true" : undefined}
        className="player-range min-w-0 flex-1"
        style={{ "--range-fill": `${fill}%`, "--range-thickness": `${thickness}px` }}
      />
      {showTimes ? (
        <span className="w-9 shrink-0 text-[11px] tabular-nums text-[color:var(--player-muted)]">
          {formatTime(max)}
        </span>
      ) : null}
    </div>
  );
};

export default Scrubber;

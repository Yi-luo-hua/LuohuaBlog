import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiChevronLeft,
  FiChevronRight,
  FiPause,
  FiPlay,
  FiSkipBack,
  FiSkipForward,
} from "react-icons/fi";
import EqualizerBars from "./controls/EqualizerBars.jsx";
import TrackCover from "./TrackCover.jsx";
import { accentVars } from "./trackAccent.js";
import { useMusicPlayer, useMusicProgress } from "./MusicPlayerProvider.jsx";
import "./player.css";

// 封面方块的宽度。收起时整行往左推这么多，封面正好完全推出屏幕，
// 贴在它右边的展开条落到 x=0，成为边缘唯一露出来的东西。
const PANEL_SHIFT = 88;
const AUTO_HIDE_MS = 1800;

// 进度只走这一层：4Hz 的 timeupdate 不该把封面图一起拖进重渲染。
const CoverProgress = () => {
  const { currentTime, duration } = useMusicProgress();
  const ratio = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-black/40"
    >
      <span
        className="block h-full bg-[color:var(--accent)] transition-[width] duration-300 ease-linear"
        style={{ width: `${ratio * 100}%` }}
      />
    </span>
  );
};

// 封面上的走带键。平时压一层暗色蒙版保证图案上的图标也读得清。
const CoverButton = ({ icon: Icon, label, onClick, size, iconSize }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    title={label}
    className="grid shrink-0 place-items-center rounded-full text-white/85 transition hover:bg-white/20 hover:text-white active:scale-90"
    style={{ width: size, height: size }}
  >
    <Icon style={{ width: iconSize, height: iconSize }} aria-hidden="true" />
  </button>
);

// 左下角的迷你播放器：一块封面，走带键直接压在封面上；不碰它就自动缩回
// 屏幕左侧，只留一根展开条。任何页面都不会被它挡住内容。
const MiniPlayerDock = ({ hidden = false }) => {
  const { hasTracks, currentTrack, isPlaying, toggle, next, prev } =
    useMusicPlayer();
  const [activated, setActivated] = useState(false);
  const [open, setOpen] = useState(false);
  const hideTimerRef = useRef(0);

  useEffect(() => {
    if (isPlaying) setActivated(true);
  }, [isPlaying]);

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), []);

  const show = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    setOpen(true);
  }, []);

  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setOpen(false), AUTO_HIDE_MS);
  }, []);

  if (hidden || !activated || !currentTrack || !hasTracks) return null;

  return (
    <div
      className="player-dark fixed bottom-6 left-0 z-40 flex items-stretch transition-transform duration-300 ease-out"
      style={{
        ...accentVars(),
        transform: open ? "translateX(12px)" : `translateX(-${PANEL_SHIFT}px)`,
      }}
      onPointerEnter={show}
      onPointerLeave={scheduleHide}
      onFocusCapture={show}
      onBlurCapture={scheduleHide}
    >
      <div className="relative">
        {/* 悬停才浮出的曲名，平时一个字都不占地方 */}
        <div
          className={`pointer-events-none absolute bottom-full left-0 mb-2 max-w-60 rounded-xl border border-white/10 bg-[#12101a]/95 px-3 py-2 shadow-xl shadow-black/50 backdrop-blur transition duration-200 ${
            open ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          <p className="truncate text-xs font-semibold text-white">
            {currentTrack.title}
          </p>
          <p className="truncate text-[11px] text-white/50">
            {currentTrack.artist}
          </p>
        </div>

        <div className="relative size-[88px] overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/60">
          <TrackCover
            track={currentTrack}
            className="size-full"
            iconClassName="size-6"
          />
          {/* 走带键直接压在封面上 */}
          <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-black/45 backdrop-blur-[1px]">
            <CoverButton
              icon={FiSkipBack}
              label="上一首"
              onClick={prev}
              size={24}
              iconSize={14}
            />
            <CoverButton
              icon={isPlaying ? FiPause : FiPlay}
              label={isPlaying ? "暂停" : "播放"}
              onClick={toggle}
              size={34}
              iconSize={19}
            />
            <CoverButton
              icon={FiSkipForward}
              label="下一首"
              onClick={next}
              size={24}
              iconSize={14}
            />
          </div>
          <Link
            to="/music"
            aria-label={`打开歌单 · 正在播放 ${currentTrack.title}`}
            title="打开歌单"
            className="absolute inset-x-0 bottom-[3px] grid h-5 place-items-center bg-black/55 text-[10px] font-medium tracking-wider text-white/60 transition hover:text-white"
          >
            歌单
          </Link>
          <CoverProgress />
        </div>
      </div>

      {/* 常驻的展开键：收起时它是屏幕边缘唯一露出来的东西。收起且在放歌时
          显示跳动的均衡器，让人一眼知道"音乐在这儿"，而不是一根光秃秃的条。 */}
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        aria-label={open ? "收起播放器" : "展开播放器"}
        aria-expanded={open}
        title={open ? "收起播放器" : "展开播放器"}
        className="group/tab my-auto grid h-14 w-6 place-items-center rounded-r-lg border border-l-0 border-white/15 bg-[#15121c]/90 text-white/70 shadow-lg shadow-black/50 backdrop-blur transition hover:bg-[#1d1927]/95 hover:text-white"
      >
        {open ? (
          <FiChevronLeft className="size-3.5" aria-hidden="true" />
        ) : isPlaying ? (
          <>
            <span className="inline-flex group-hover/tab:hidden">
              <EqualizerBars />
            </span>
            <FiChevronRight
              className="hidden size-3.5 group-hover/tab:block"
              aria-hidden="true"
            />
          </>
        ) : (
          <FiChevronRight className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
};

export default MiniPlayerDock;

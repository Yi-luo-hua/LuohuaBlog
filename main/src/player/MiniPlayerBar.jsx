import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiList,
  FiMusic,
  FiPause,
  FiPlay,
  FiRepeat,
  FiRotateCcw,
  FiShuffle,
  FiSkipBack,
  FiSkipForward,
  FiVolume2,
  FiVolumeX,
} from "react-icons/fi";
import { formatTime } from "../lib/formatTime.js";
import {
  MUSIC_MODE_LABELS,
  useMusicPlayer,
  useMusicProgress,
} from "./MusicPlayerProvider.jsx";
import TrackCover from "./TrackCover.jsx";

const MODE_ICONS = {
  order: FiList,
  repeat: FiRepeat,
  shuffle: FiShuffle,
  one: FiRotateCcw,
};

const controlButtonClass =
  "grid size-9 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white";

// 常驻悬浮播放条。本次会话播放过一次后出现，跨页面不消失；
// /about（全屏气泡板，自带播放器卡片）和 /music（完整播放器）由
// SiteLayout 传 hidden 整体关闭，避免两套控件叠在一起。
const MiniPlayerBar = ({ hidden = false }) => {
  const {
    hasTracks,
    currentTrack,
    isPlaying,
    mode,
    volume,
    muted,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    cycleMode,
  } = useMusicPlayer();
  const { currentTime, duration } = useMusicProgress();
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (isPlaying) setActivated(true);
  }, [isPlaying]);

  if (hidden || !activated || !currentTrack || !hasTracks) return null;

  const ModeIcon = MODE_ICONS[mode] || FiRepeat;
  const VolumeIcon = muted || volume === 0 ? FiVolumeX : FiVolume2;
  const progressMax = duration || 0;

  return (
    <>
      {/* 占位：给 Footer 留出被悬浮条盖住的高度 */}
      <div aria-hidden="true" className="h-24" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3">
        <div className="pointer-events-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-[#171321]/90 text-white shadow-2xl shadow-black/40 backdrop-blur-md">
          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <Link
              to="/music"
              className="shrink-0"
              aria-label="打开音乐播放页"
            >
              <TrackCover
                track={currentTrack}
                className="size-10 rounded-lg"
                iconClassName="size-4"
              />
            </Link>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="truncate text-sm font-semibold">
                  {currentTrack.title}
                </p>
                <span className="hidden truncate text-xs text-white/50 sm:block">
                  {currentTrack.artist}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-white/60">
                <span className="tabular-nums">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min="0"
                  max={progressMax}
                  step="0.1"
                  value={Math.min(currentTime, progressMax)}
                  onChange={(event) => seek(Number(event.target.value))}
                  className="h-1 w-full min-w-0 accent-violet-400"
                  aria-label="播放进度"
                />
                <span className="tabular-nums">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={prev}
                className={`${controlButtonClass} hidden sm:grid`}
                aria-label="上一首"
              >
                <FiSkipBack />
              </button>
              <button
                type="button"
                onClick={toggle}
                className="grid size-10 place-items-center rounded-full bg-white text-[#171321] transition hover:bg-violet-200"
                aria-label={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? <FiPause /> : <FiPlay className="translate-x-px" />}
              </button>
              <button
                type="button"
                onClick={next}
                className={controlButtonClass}
                aria-label="下一首"
              >
                <FiSkipForward />
              </button>
              <button
                type="button"
                onClick={cycleMode}
                className={`${controlButtonClass} hidden sm:grid`}
                aria-label={`播放模式：${MUSIC_MODE_LABELS[mode]}`}
                title={MUSIC_MODE_LABELS[mode]}
              >
                <ModeIcon />
              </button>
              <button
                type="button"
                onClick={toggleMute}
                className={`${controlButtonClass} hidden md:grid`}
                aria-label={muted ? "取消静音" : "静音"}
              >
                <VolumeIcon />
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={muted ? 0 : volume}
                onChange={(event) => setVolume(Number(event.target.value))}
                className="hidden h-1 w-16 accent-violet-400 md:block"
                aria-label="音量"
              />
              <Link
                to="/music"
                className={`${controlButtonClass} hidden md:grid`}
                aria-label="打开完整播放器"
                title="打开完整播放器"
              >
                <FiMusic />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MiniPlayerBar;

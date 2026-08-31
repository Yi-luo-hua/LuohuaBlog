import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiMusic,
  FiPlay,
  FiShuffle,
  FiSkipBack,
  FiSkipForward,
} from "react-icons/fi";
import { cosAsset } from "../lib/cosAsset.js";
import { formatTime } from "../lib/formatTime.js";
import {
  useMusicPlayer,
  useMusicProgress,
} from "../player/MusicPlayerProvider.jsx";
import TrackCover from "../player/TrackCover.jsx";
import { accentVars } from "../player/trackAccent.js";
import EqualizerBars from "../player/controls/EqualizerBars.jsx";
import IconButton from "../player/controls/IconButton.jsx";
import ModeControl from "../player/controls/ModeControl.jsx";
import PlayPauseButton from "../player/controls/PlayPauseButton.jsx";
import Scrubber from "../player/controls/Scrubber.jsx";
import VolumeControl from "../player/controls/VolumeControl.jsx";
import "../player/player.css";

// 背景画。页面的颜色只从这里来，界面本身一点颜色都不出，只铺中性的白色
// 透明层。这张图固定不变，和歌单封面是两张不同的图（网易云也是这样：
// 歌单封面归歌单，背景是另铺的一张壁纸）。
const BACKDROP = cosAsset(
  "AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/img/hero-4.webp",
);
const OWNER_AVATAR = "/github-avatar.png";

const formatTotal = (seconds) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
};

// 底部播放条。进度条在这里，所以整块单独订阅 useMusicProgress——
// 上面的歌单列表不会跟着 4Hz 重渲染。
const PlaybackBar = () => {
  const {
    currentTrack,
    isPlaying,
    isBuffering,
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
    setMode,
  } = useMusicPlayer();
  const { currentTime, duration } = useMusicProgress();

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0a090e]/80 backdrop-blur-2xl">
      {/* 窄屏靠 flex-wrap 自然折成两行：上行是封面/曲名/走带键，
          进度条整条掉到下一行；sm 以上回到一行排开。 */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:flex-nowrap sm:gap-4 sm:py-3 md:px-8">
        <TrackCover
          track={currentTrack}
          className="size-11 rounded-lg md:size-12"
          iconClassName="size-5"
        />
        <div className="min-w-0 flex-1 sm:w-40 sm:flex-none lg:w-56">
          <p className="truncate text-sm font-medium">{currentTrack.title}</p>
          <p className="truncate text-xs text-[color:var(--player-muted)]">
            {currentTrack.artist}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:order-2 sm:gap-2">
          <IconButton
            icon={FiSkipBack}
            label="上一首"
            onClick={prev}
            size={34}
            iconSize={18}
          />
          <PlayPauseButton
            isPlaying={isPlaying}
            busy={isBuffering}
            onClick={toggle}
            size={42}
            iconSize={18}
          />
          <IconButton
            icon={FiSkipForward}
            label="下一首"
            onClick={next}
            size={34}
            iconSize={18}
          />
        </div>

        {/* 窄屏时这两块合成第二行；sm 以上 display:contents 让它们直接
            回到外层那一行，各就各位。 */}
        <div className="order-last flex w-full items-center gap-2 sm:contents">
          <Scrubber
            currentTime={currentTime}
            duration={duration}
            onSeek={seek}
            className="min-w-0 flex-1 sm:order-2"
          />

          <div className="flex shrink-0 items-center gap-2 sm:order-2">
            <ModeControl
              mode={mode}
              onCycle={cycleMode}
              onSelect={setMode}
              variant="cycle"
              className="lg:hidden"
            />
            <ModeControl
              mode={mode}
              onCycle={cycleMode}
              onSelect={setMode}
              variant="segmented"
              className="hidden lg:flex"
            />
            <VolumeControl
              volume={volume}
              muted={muted}
              onToggleMute={toggleMute}
              onChange={setVolume}
              className="hidden md:flex"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const TrackRow = ({ track, index, isCurrent, isPlaying, onPlay }) => (
  <li>
    <button
      type="button"
      onClick={onPlay}
      // 点当前正在播的那一行是暂停，不是重播——aria-label 要说实话
      aria-label={
        isCurrent && isPlaying ? `暂停 ${track.title}` : `播放 ${track.title}`
      }
      className={`group/row flex w-full items-center gap-3 px-3 py-2 text-left transition ${
        isCurrent ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"
      }`}
    >
      <span className="grid w-8 shrink-0 place-items-center text-xs tabular-nums text-white/35">
        {isCurrent && isPlaying ? (
          <EqualizerBars />
        ) : (
          <>
            <span className="group-hover/row:hidden">
              {String(index + 1).padStart(2, "0")}
            </span>
            <FiPlay
              aria-hidden="true"
              className="hidden size-3.5 text-white group-hover/row:block"
            />
          </>
        )}
      </span>

      <TrackCover
        track={track}
        className="size-10 rounded"
        iconClassName="size-4"
      />

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-sm ${
            isCurrent ? "text-[color:var(--accent)]" : "text-white/90"
          }`}
        >
          {track.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-white/45">
          {track.artist}
        </span>
      </span>

      <span className="hidden w-48 shrink-0 truncate text-xs text-white/45 lg:block">
        {track.album || "—"}
      </span>
      <span className="w-12 shrink-0 text-right text-xs tabular-nums text-white/35">
        {track.duration ? formatTime(track.duration) : "--:--"}
      </span>
    </button>
  </li>
);

// 歌单头的大封面。取不到就退回背景那张图——碎图标比"没有封面"难看得多。
const PlaylistCover = ({ src }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <img
      src={failed ? BACKDROP : src}
      alt=""
      onError={() => setFailed(true)}
      className="size-44 shrink-0 rounded-xl object-cover shadow-2xl shadow-black/60 ring-1 ring-white/15 sm:size-52"
    />
  );
};

const MusicPage = () => {
  const {
    tracks,
    hasTracks,
    currentId,
    isPlaying,
    failed,
    playTrack,
    setMode,
  } = useMusicPlayer();

  // 歌单封面认"第一首带封面的曲目"，而不是死认 tracks[0]：置顶曲和无标签的
  // 文件都可能没有内嵌封面，那样封面会平白退回背景图。切歌时封面不变——这是
  // 歌单自己的身份，不该跟着正在播的那首换脸。
  const cover = tracks.find((track) => track.cover)?.cover || BACKDROP;

  const totalLabel = useMemo(
    () =>
      formatTotal(
        tracks.reduce((sum, track) => sum + (track.duration || 0), 0),
      ),
    [tracks],
  );

  const playAll = () => {
    if (!hasTracks) return;
    playTrack(currentId || tracks[0].id);
  };

  const shuffleAll = () => {
    if (!hasTracks) return;
    setMode("shuffle");
    playTrack(tracks[Math.floor(Math.random() * tracks.length)].id);
  };

  // 强调色挂在整页根节点上：底部播放条是内容容器的兄弟节点，变量挂在容器上
  // 会漏掉播放条里的主按钮和进度条。
  return (
    <main
      className="player-dark relative min-h-screen bg-[#0a090e] pb-32 pt-24 text-white md:pt-28"
      style={accentVars()}
    >
      {/* 背景画。整页的颜色只从这里来，上面的界面一律是中性白透明层。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden"
      >
        <img
          src={BACKDROP}
          alt=""
          className="size-full scale-105 object-cover object-[center_30%] blur-[2px]"
        />
        <div className="absolute inset-0 bg-[#0a090e]/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a090e]/25 via-[#0a090e]/60 to-[#0a090e]" />
      </div>

      <div className="container relative mx-auto max-w-6xl px-5 md:px-10">
        <header className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          {/* 曲库里一张封面都没有（或那张图取不到）时退回背景那张图——
              总比一块空的深色方块像"一张真的歌单封面"。 */}
          <PlaylistCover src={cover} />
          <div className="min-w-0 flex-1">
            <span className="inline-block rounded border border-[color:var(--accent)] px-1.5 py-px text-[11px] font-medium text-[color:var(--accent)]">
              歌单
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              我的歌单
            </h1>

            <div className="mt-4 flex items-center gap-2 text-xs text-white/45">
              <img
                src={OWNER_AVATAR}
                alt=""
                className="size-5 rounded-full ring-1 ring-white/20"
              />
              <span className="text-white/70">伊洛华</span>
              <span>· 自建曲库</span>
            </div>

            {hasTracks ? (
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={playAll}
                  className="flex items-center gap-1.5 rounded-full bg-[color:var(--accent)] px-5 py-2 text-sm font-medium text-[color:var(--accent-ink)] transition hover:brightness-110 active:scale-95"
                >
                  {isPlaying ? (
                    <EqualizerBars onAccent />
                  ) : (
                    <FiPlay aria-hidden="true" className="size-4" />
                  )}
                  {isPlaying ? "正在播放" : "播放全部"}
                </button>
                <button
                  type="button"
                  onClick={shuffleAll}
                  className="flex items-center gap-1.5 rounded-full border border-white/20 px-5 py-2 text-sm text-white/85 transition hover:border-white/40 hover:bg-white/10 active:scale-95"
                >
                  <FiShuffle aria-hidden="true" className="size-4" />
                  随机播放
                </button>
              </div>
            ) : null}

            <p className="mt-4 text-xs text-white/40">
              {hasTracks
                ? `歌曲 ${tracks.length}${totalLabel ? ` · 时长 ${totalLabel}` : ""}`
                : "曲库还空着"}
            </p>
          </div>
        </header>

        {failed ? (
          <p className="mt-8 flex items-center gap-2 rounded-lg border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-200">
            <FiAlertCircle aria-hidden="true" className="size-4 shrink-0" />
            这些曲目现在都加载不出来，检查一下曲库是否已同步到服务器。
          </p>
        ) : null}

        {hasTracks ? (
          <section className="mt-10" aria-label="歌单列表">
            <div className="flex items-center gap-3 border-b border-white/10 px-3 pb-2 text-xs text-white/35">
              <span className="w-8 shrink-0 text-center">#</span>
              <span className="w-10 shrink-0" />
              <span className="min-w-0 flex-1">标题</span>
              <span className="hidden w-48 shrink-0 lg:block">专辑</span>
              <span className="w-12 shrink-0 text-right">时长</span>
            </div>
            {/* 斑马纹是网易云那张表的可读性来源：行与行之间不靠边框分隔 */}
            <ol className="overflow-hidden rounded-b-lg [&>li:nth-child(odd)]:bg-white/[0.025]">
              {tracks.map((track, index) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={index}
                  isCurrent={track.id === currentId}
                  isPlaying={isPlaying}
                  onPlay={() => playTrack(track.id)}
                />
              ))}
            </ol>
          </section>
        ) : (
          <div className="mt-10 rounded-lg border border-dashed border-white/15 px-6 py-16 text-center">
            <FiMusic
              aria-hidden="true"
              className="mx-auto size-9 text-white/25"
            />
            <p className="mt-4 text-sm text-white/50">
              歌单还是空的。把音频文件放进本地音乐目录后运行
              <code className="mx-1.5 rounded bg-white/10 px-1.5 py-0.5 text-xs text-white/80">
                python tools/sync_music.py --source 目录
              </code>
              即可入库。
            </p>
          </div>
        )}
      </div>

      <PlaybackBar />
    </main>
  );
};

export default MusicPage;

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
  MUSIC_PLAY_MODES,
  useMusicPlayer,
  useMusicProgress,
} from "../player/MusicPlayerProvider.jsx";
import TrackCover from "../player/TrackCover.jsx";

const MODE_ICONS = {
  order: FiList,
  repeat: FiRepeat,
  shuffle: FiShuffle,
  one: FiRotateCcw,
};

// 正在播放的那一行右侧用三根跳动条代替序号。
const EqualizerBars = () => (
  <span className="flex h-4 items-end justify-center gap-[3px]" aria-hidden="true">
    {[0, 1, 2].map((index) => (
      <span
        key={index}
        className="w-[3px] animate-bounce rounded-full bg-violet-500"
        style={{ animationDelay: `${index * 0.15}s`, animationDuration: "0.9s" }}
      />
    ))}
  </span>
);

// 进度 4Hz 更新，单独拆出来，列表部分不跟着重渲染。
const NowPlayingPanel = () => {
  const {
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
    setMode,
  } = useMusicPlayer();
  const { currentTime, duration } = useMusicProgress();

  if (!currentTrack) {
    return (
      <p className="rounded-3xl border border-[#241322]/10 bg-white/60 px-6 py-10 text-center text-sm text-[#241322]/60">
        还没有开始播放——从下面的列表挑一首吧。
      </p>
    );
  }

  const ModeIcon = MODE_ICONS[mode] || FiRepeat;
  const VolumeIcon = muted || volume === 0 ? FiVolumeX : FiVolume2;
  const progressMax = duration || 0;

  return (
    <section
      className="flex flex-col gap-6 rounded-3xl border border-[#241322]/10 bg-white/70 p-6 shadow-[0_18px_50px_rgba(36,19,34,0.08)] backdrop-blur sm:flex-row sm:items-center sm:gap-8 sm:p-8"
      aria-label="正在播放"
    >
      <TrackCover
        track={currentTrack}
        className="size-40 rounded-2xl shadow-lg sm:size-48"
        iconClassName="size-12"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-violet-500">
          Now Playing
        </p>
        <h2 className="mt-2 truncate text-2xl font-bold">{currentTrack.title}</h2>
        <p className="mt-1 truncate text-sm text-[#241322]/60">
          {currentTrack.artist}
          {currentTrack.album ? ` · ${currentTrack.album}` : ""}
        </p>

        <div className="mt-4 flex items-center gap-3 text-xs tabular-nums text-[#241322]/60">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={progressMax}
            step="0.1"
            value={Math.min(currentTime, progressMax)}
            onChange={(event) => seek(Number(event.target.value))}
            className="h-1.5 flex-1 accent-violet-500"
            aria-label="播放进度"
          />
          <span>{formatTime(duration)}</span>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={prev}
            className="grid size-11 place-items-center rounded-full text-[#241322]/70 transition hover:bg-[#241322]/5 hover:text-[#241322]"
            aria-label="上一首"
          >
            <FiSkipBack />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="grid size-14 place-items-center rounded-full bg-[#241322] text-white shadow-lg transition hover:bg-violet-600"
            aria-label={isPlaying ? "暂停" : "播放"}
          >
            {isPlaying ? <FiPause /> : <FiPlay className="translate-x-px" />}
          </button>
          <button
            type="button"
            onClick={next}
            className="grid size-11 place-items-center rounded-full text-[#241322]/70 transition hover:bg-[#241322]/5 hover:text-[#241322]"
            aria-label="下一首"
          >
            <FiSkipForward />
          </button>

          <div className="ml-2 hidden items-center gap-1 rounded-full bg-[#241322]/5 p-1 sm:flex">
            {MUSIC_PLAY_MODES.map((playMode) => {
              const ModeOptionIcon = MODE_ICONS[playMode];
              return (
                <button
                  key={playMode}
                  type="button"
                  onClick={() => setMode(playMode)}
                  className={`grid size-8 place-items-center rounded-full transition ${
                    mode === playMode
                      ? "bg-white text-violet-600 shadow"
                      : "text-[#241322]/50 hover:text-[#241322]"
                  }`}
                  aria-label={MUSIC_MODE_LABELS[playMode]}
                  title={MUSIC_MODE_LABELS[playMode]}
                >
                  <ModeOptionIcon />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={cycleMode}
            className="ml-auto grid size-9 place-items-center rounded-full text-[#241322]/60 transition hover:bg-[#241322]/5 hover:text-[#241322] sm:hidden"
            aria-label={`播放模式：${MUSIC_MODE_LABELS[mode]}`}
          >
            <ModeIcon />
          </button>

          <button
            type="button"
            onClick={toggleMute}
            className="ml-auto hidden size-9 place-items-center rounded-full text-[#241322]/60 transition hover:bg-[#241322]/5 hover:text-[#241322] sm:ml-2 sm:grid"
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
            className="hidden h-1.5 w-24 accent-violet-500 sm:block"
            aria-label="音量"
          />
        </div>
      </div>
    </section>
  );
};

const MusicPage = () => {
  const {
    tracks,
    hasTracks,
    currentId,
    isPlaying,
    mode,
    playTrack,
    toggle,
  } = useMusicPlayer();

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#f5f1ea] via-[#f4f0ee] to-[#efe9f7] pb-32 pt-24 text-[#241322]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 right-[-10%] size-[420px] rounded-full bg-violet-300/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-15%] left-[-8%] size-[380px] rounded-full bg-rose-300/25 blur-3xl"
      />

      <header className="container mx-auto px-5 pb-8 md:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#241322]/50">
          Music Player
        </p>
        <h1 className="mt-3 font-zentry text-5xl md:text-7xl">音乐播放器</h1>
        <p className="mt-3 text-sm text-[#241322]/60">
          {hasTracks
            ? `共 ${tracks.length} 首 · ${MUSIC_MODE_LABELS[mode]}`
            : "曲库还空着"}
        </p>
      </header>

      <div className="container mx-auto px-5 md:px-10">
        <NowPlayingPanel />

        {hasTracks ? (
          <ol className="mt-8 overflow-hidden rounded-3xl border border-[#241322]/10 bg-white/70 backdrop-blur">
            {tracks.map((track, index) => {
              const isCurrent = track.id === currentId;
              return (
                <li key={track.id}>
                  <button
                    type="button"
                    onClick={() => playTrack(track.id)}
                    className={`flex w-full items-center gap-4 px-5 py-3 text-left transition ${
                      isCurrent ? "bg-violet-500/10" : "hover:bg-[#241322]/5"
                    } ${index > 0 ? "border-t border-[#241322]/5" : ""}`}
                    aria-label={`播放 ${track.title}`}
                  >
                    <span className="w-6 shrink-0 text-center text-sm tabular-nums text-[#241322]/50">
                      {isCurrent && isPlaying ? (
                        <EqualizerBars />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <TrackCover
                      track={track}
                      className="size-10 rounded-lg"
                      iconClassName="size-4"
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm font-semibold ${
                          isCurrent ? "text-violet-600" : ""
                        }`}
                      >
                        {track.title}
                      </span>
                      <span className="block truncate text-xs text-[#241322]/55">
                        {track.artist}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-[#241322]/50">
                      {formatTime(track.duration)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="mt-8 rounded-3xl border border-dashed border-[#241322]/20 bg-white/50 px-6 py-14 text-center">
            <FiMusic className="mx-auto size-10 text-[#241322]/30" />
            <p className="mt-4 text-sm text-[#241322]/60">
              播放清单还没有曲目。把音频文件放进本地音乐目录后运行
              <code className="mx-1 rounded bg-[#241322]/10 px-1.5 py-0.5 text-xs">
                python tools/sync_music.py --source 目录
              </code>
              即可入库。
            </p>
          </div>
        )}

        {!hasTracks ? null : (
          <p className="mt-6 text-center text-xs text-[#241322]/45">
            想随手控制？导航栏的音乐按钮随时播放/暂停，切到别的页面音乐不会停。
            {isPlaying ? " " : ""}
            {!isPlaying && currentId ? (
              <button
                type="button"
                onClick={toggle}
                className="text-violet-600 underline-offset-2 hover:underline"
              >
                继续播放 {tracks.find((t) => t.id === currentId)?.title}
              </button>
            ) : null}
          </p>
        )}
      </div>
    </main>
  );
};

export default MusicPage;

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { musicTracks } from "../data/musicTracks.js";

// 顺序 / 列表循环 / 随机 / 单曲循环。cycleMode 按这个数组的顺序循环切换，
// UI 图标映射见 MiniPlayerBar / MusicPage。
export const MUSIC_PLAY_MODES = ["order", "repeat", "shuffle", "one"];

export const MUSIC_MODE_LABELS = {
  order: "顺序播放",
  repeat: "列表循环",
  shuffle: "随机播放",
  one: "单曲循环",
};

const STORAGE_KEY = "luohua-music-player";

const MusicPlayerStateContext = createContext(null);
const MusicPlayerProgressContext = createContext({ currentTime: 0, duration: 0 });

// timeupdate 每秒触发约 4 次。currentTime/duration 被隔离在这层独立的
// Provider 里：4Hz 的重渲染只会命中订阅 useMusicProgress 的组件（各处进度条），
// 不会波及整棵页面树——首页挂着 GSAP / matter-js 动画，全树重渲染代价不小。
const ProgressBridge = ({ audioRef, children }) => {
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    const sync = () =>
      setProgress({
        currentTime: audio.currentTime || 0,
        duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      });
    sync();
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("loadedmetadata", sync);
    audio.addEventListener("durationchange", sync);
    audio.addEventListener("seeked", sync);
    return () => {
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("loadedmetadata", sync);
      audio.removeEventListener("durationchange", sync);
      audio.removeEventListener("seeked", sync);
    };
  }, [audioRef]);

  return (
    <MusicPlayerProgressContext.Provider value={progress}>
      {children}
    </MusicPlayerProgressContext.Provider>
  );
};

const readStoredState = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      currentId: typeof parsed.currentId === "string" ? parsed.currentId : null,
      mode: MUSIC_PLAY_MODES.includes(parsed.mode) ? parsed.mode : null,
      volume: Number.isFinite(parsed.volume)
        ? Math.min(1, Math.max(0, parsed.volume))
        : null,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return null;
  }
};

// Fisher-Yates 洗牌；正在播的曲目置首，保证开启随机不打断当前收听。
const shuffledOrder = (ids, firstId) => {
  const remaining = ids.filter((id) => id !== firstId);
  for (let i = remaining.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  return firstId ? [firstId, ...remaining] : remaining;
};

export const MusicPlayerProvider = ({ children }) => {
  const audioRef = useRef(null);
  const loadedIdRef = useRef(null);
  const failureCountRef = useRef(0);

  const [stored] = useState(readStoredState);

  const trackById = useMemo(
    () => Object.fromEntries(musicTracks.map((track) => [track.id, track])),
    [],
  );
  const trackIds = useMemo(() => musicTracks.map((track) => track.id), []);

  const [currentId, setCurrentId] = useState(() =>
    stored?.currentId && trackById[stored.currentId] ? stored.currentId : null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setModeState] = useState(() =>
    stored?.mode && MUSIC_PLAY_MODES.includes(stored.mode) ? stored.mode : "repeat",
  );
  const [volume, setVolumeState] = useState(() =>
    Number.isFinite(stored?.volume) ? stored.volume : 0.8,
  );
  const [muted, setMuted] = useState(() => Boolean(stored?.muted));
  const [shuffleOrder, setShuffleOrder] = useState(null);

  // 事件回调里要读最新状态；直接闭包会拿到旧值，进依赖又会频繁重挂。
  const liveRef = useRef({});
  liveRef.current = { currentId, mode, trackIds, trackById };

  const playOrder =
    mode === "shuffle" && shuffleOrder ? shuffleOrder : trackIds;
  liveRef.current.playOrder = playOrder;

  const currentTrack = currentId ? trackById[currentId] || null : null;

  const startTrack = useCallback(
    (id, { autoplay = true } = {}) => {
      const track = trackById[id];
      if (!track) return;
      loadedIdRef.current = id;
      setCurrentId(id);
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.getAttribute("src") !== track.src) {
        audio.src = track.src;
      }
      audio.currentTime = 0;
      if (!autoplay) return;
      const playback = audio.play();
      if (playback) playback.catch(() => setIsPlaying(false));
    },
    [trackById],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const { currentId: id, playOrder: order, trackById: byId } = liveRef.current;
    if (!id || loadedIdRef.current !== id || !audio.getAttribute("src")) {
      startTrack(id || order.find((tid) => byId[tid]));
      return;
    }
    if (audio.paused) {
      const playback = audio.play();
      if (playback) playback.catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [startTrack]);

  // 按 delta 在播放顺序里找相邻曲目。wrap=false（顺序模式）到头返回 null，
  // 由调用方决定"停在末尾"；wrap=true（循环/随机）绕回另一端。
  const neighborId = useCallback((delta, wrap) => {
    const { currentId: id, playOrder: order, trackById: byId } = liveRef.current;
    const playable = order.filter((tid) => byId[tid]);
    if (!playable.length) return null;
    if (!id) return delta > 0 ? playable[0] : playable[playable.length - 1];
    const index = playable.indexOf(id);
    if (index === -1) return playable[0];
    const target = index + delta;
    if (target < 0) return wrap ? playable[playable.length - 1] : playable[0];
    if (target >= playable.length) return wrap ? playable[0] : null;
    return playable[target];
  }, []);

  const next = useCallback(() => {
    const { mode: currentMode } = liveRef.current;
    const id = neighborId(1, currentMode !== "order");
    if (id) {
      startTrack(id);
    } else {
      // 顺序模式播到列表末尾：停在原地
      audioRef.current?.pause();
    }
  }, [neighborId, startTrack]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const { mode: currentMode } = liveRef.current;
    const id = neighborId(-1, currentMode !== "order");
    if (id) startTrack(id);
  }, [neighborId, startTrack]);

  const seek = useCallback((time) => {
    const audio = audioRef.current;
    if (!audio) return;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    audio.currentTime = Math.max(0, Math.min(duration, time));
  }, []);

  const seekBy = useCallback(
    (offset) => {
      const audio = audioRef.current;
      if (audio) seek(audio.currentTime + offset);
    },
    [seek],
  );

  const setVolume = useCallback((value) => {
    setVolumeState(Math.min(1, Math.max(0, Number(value) || 0)));
  }, []);

  const toggleMute = useCallback(() => setMuted((prev) => !prev), []);

  const cycleMode = useCallback(() => {
    setModeState((prev) => {
      const index = MUSIC_PLAY_MODES.indexOf(prev);
      return MUSIC_PLAY_MODES[(index + 1) % MUSIC_PLAY_MODES.length];
    });
  }, []);

  const setMode = useCallback((nextMode) => {
    if (MUSIC_PLAY_MODES.includes(nextMode)) setModeState(nextMode);
  }, []);

  const playTrack = useCallback(
    (id) => {
      if (id && id === loadedIdRef.current) {
        toggle();
        return;
      }
      startTrack(id);
    },
    [startTrack, toggle],
  );

  // 单曲循环交给 audio.loop，ended 正常只在其他三种模式出现。
  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    const { mode: currentMode } = liveRef.current;
    const id = neighborId(1, currentMode !== "order");
    if (id) startTrack(id);
  }, [neighborId, startTrack]);

  const handleError = useCallback(() => {
    const { currentId: id, trackIds: ids } = liveRef.current;
    if (!id) return;
    failureCountRef.current += 1;
    // 整张清单都播不动时停下来，别无限绕圈。
    if (failureCountRef.current >= ids.length) {
      failureCountRef.current = 0;
      audioRef.current?.pause();
      return;
    }
    const target = neighborId(1, true);
    if (target && target !== id) startTrack(target);
  }, [neighborId, startTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
    audio.muted = muted;
  }, [volume, muted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.loop = mode === "one";
  }, [mode]);

  // 刷新后从 localStorage 恢复的曲目：把 src 预挂上，让 preload="metadata"
  // 拿到真实时长（进度条/时长显示不用等播放才开始）；不自动播放。
  useEffect(() => {
    const audio = audioRef.current;
    const track = currentId ? trackById[currentId] : null;
    if (!audio || !track) return;
    if (loadedIdRef.current === currentId) return;
    if (audio.getAttribute("src") !== track.src) {
      audio.src = track.src;
    }
  }, [currentId, trackById]);

  useEffect(() => {
    if (mode === "shuffle") {
      setShuffleOrder(shuffledOrder(liveRef.current.trackIds, liveRef.current.currentId));
    } else {
      setShuffleOrder(null);
    }
  }, [mode]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentId, mode, volume, muted }),
      );
    } catch {
      // 隐私模式等场景下存不进去就存不进去，不影响播放
    }
  }, [currentId, mode, volume, muted]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return undefined;
    }
    const session = navigator.mediaSession;
    const audio = audioRef.current;
    if (currentTrack) {
      session.metadata = new window.MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album || "伊洛华 · 音乐",
        artwork: currentTrack.cover
          ? [{ src: currentTrack.cover, sizes: "512x512", type: "image/jpeg" }]
          : [],
      });
    }
    session.setActionHandler("play", () => {
      audio?.play().catch(() => {});
    });
    session.setActionHandler("pause", () => audio?.pause());
    session.setActionHandler("previoustrack", () => prev());
    session.setActionHandler("nexttrack", () => next());
    session.setActionHandler("seekto", (details) => {
      if (audio && Number.isFinite(details.seekTime)) {
        audio.currentTime = details.seekTime;
      }
    });
    return () => {
      session.setActionHandler("play", null);
      session.setActionHandler("pause", null);
      session.setActionHandler("previoustrack", null);
      session.setActionHandler("nexttrack", null);
      session.setActionHandler("seekto", null);
    };
  }, [currentTrack, next, prev]);

  const stateValue = useMemo(
    () => ({
      tracks: musicTracks,
      hasTracks: musicTracks.length > 0,
      currentId,
      currentTrack,
      isPlaying,
      mode,
      volume,
      muted,
      playTrack,
      toggle,
      next,
      prev,
      seek,
      seekBy,
      setVolume,
      toggleMute,
      cycleMode,
      setMode,
    }),
    [
      currentId,
      currentTrack,
      isPlaying,
      mode,
      volume,
      muted,
      playTrack,
      toggle,
      next,
      prev,
      seek,
      seekBy,
      setVolume,
      toggleMute,
      cycleMode,
      setMode,
    ],
  );

  return (
    <MusicPlayerStateContext.Provider value={stateValue}>
      <ProgressBridge audioRef={audioRef}>{children}</ProgressBridge>
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => {
          setIsPlaying(true);
          if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "playing";
          }
        }}
        onPlaying={() => {
          failureCountRef.current = 0;
          setIsPlaying(true);
        }}
        onPause={() => {
          setIsPlaying(false);
          if (typeof navigator !== "undefined" && "mediaSession" in navigator) {
            navigator.mediaSession.playbackState = "paused";
          }
        }}
        onEnded={handleEnded}
        onError={handleError}
      />
    </MusicPlayerStateContext.Provider>
  );
};

// 播放器的稳定状态与操作。触发重渲染的频率 = 用户操作频率。
export const useMusicPlayer = () => useContext(MusicPlayerStateContext);

// 仅进度（currentTime/duration）。只有进度条组件该订阅它——每秒约 4 次更新。
export const useMusicProgress = () => useContext(MusicPlayerProgressContext);

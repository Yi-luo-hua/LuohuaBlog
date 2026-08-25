import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiArrowUpRight,
  FiBookOpen,
  FiCode,
  FiFilm,
  FiImage,
  FiMail,
  FiMusic,
  FiPause,
  FiPlay,
  FiSkipBack,
  FiSkipForward,
  FiVolume2,
} from "react-icons/fi";
import { FaGithub, FaQq } from "react-icons/fa";
import { SiBilibili, SiPixiv } from "react-icons/si";

import { blogPosts } from "virtual:blog-posts";
import { FEATURED_PROJECT } from "../data/featuredProject.js";
import { galleryAlbums } from "../data/galleryAlbums.js";
import { API_BASE } from "../lib/apiBase.js";
import { cosAsset } from "../lib/cosAsset.js";
import { copyTextToClipboard } from "../lib/copyTextToClipboard.js";
import { makePosterDataUri, resolveCoverSrc } from "../lib/posterPlaceholder.js";
import { getBangumiCollection, getGithubCommits } from "../services/acgApi.js";
import aboutFontsHref from "./aboutFonts.css?url";
import "./AboutSitePage.css";
import { useBubblePhysics } from "./useBubblePhysics.js";
import { useConstellationFit } from "./useConstellationFit.js";

const MAIN_ASSET_BASE = cosAsset("AI自动化博客图片/main");
const HERO_IMAGES = [
  `${MAIN_ASSET_BASE}/img/hero-2.webp`,
  `${MAIN_ASSET_BASE}/img/about.webp`,
  `${MAIN_ASSET_BASE}/img/hero-3.webp`,
];
const MUSIC_SRC = `${MAIN_ASSET_BASE}/audio/loop.mp3`;

const FALLBACK_POST = {
  title: "博客尚未更新",
  dateLabel: "等待第一篇文章",
  summary: "新的文字正在路上。",
  url: "/blog/",
};

const OWNER_NAME = "Yi-luo-hua";
const GITHUB_PROFILE = "https://github.com/Yi-luo-hua";
const PIXIV_PROFILE = "https://www.pixiv.net/users/42846132";
const EMAIL_ADDRESS = "akesakiko@gmail.com";
const QQ_NUMBER = "3043882857";
const COMMIT_ROWS = 4;

// Repos are shown by their short name; the owner prefix is the same on nearly
// every row and just eats the width this card does not have.
const shortRepoName = (fullName) => String(fullName || "").split("/").pop() || "";

const relativeCommitTime = (isoDate, now) => {
  const at = new Date(isoDate);
  if (Number.isNaN(at.getTime())) return "";
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  return `${at.getMonth() + 1}.${at.getDate()}`;
};

const greetingFor = (hour) => {
  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const formatClock = (date) =>
  `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
};

const CLOCK_SEGMENTS = {
  0: [1, 1, 1, 1, 1, 1, 0],
  1: [0, 1, 1, 0, 0, 0, 0],
  2: [1, 1, 0, 1, 1, 0, 1],
  3: [1, 1, 1, 1, 0, 0, 1],
  4: [0, 1, 1, 0, 0, 1, 1],
  5: [1, 0, 1, 1, 0, 1, 1],
  6: [1, 0, 1, 1, 1, 1, 1],
  7: [1, 1, 1, 0, 0, 0, 0],
  8: [1, 1, 1, 1, 1, 1, 1],
  9: [1, 1, 1, 1, 0, 1, 1],
};

const CLOCK_SEGMENT_POINTS = [
  "4,1 25,1 22,5 7,5",
  "25,4 29,7 29,22 25,25 24,22 24,7",
  "25,28 29,31 29,46 25,50 24,46 24,31",
  "7,47 22,47 25,51 4,51",
  "4,28 5,31 5,46 2,50 0,46 0,31",
  "4,4 5,7 5,22 2,25 0,22 0,7",
  "4,24 25,24 27,26 25,28 4,28 2,26",
];

const renderClockDigit = (value, key) => {
  const segments = CLOCK_SEGMENTS[Number(value)] || CLOCK_SEGMENTS[0];
  return (
    <svg key={key} className="about-desk-clock-digit" viewBox="0 0 29 52" aria-hidden="true">
      {CLOCK_SEGMENT_POINTS.map((points, index) => (
        <polygon key={points} points={points} className={segments[index] ? "is-on" : ""} />
      ))}
    </svg>
  );
};

const renderClockColon = () => (
  <span className="about-desk-clock-colon" aria-hidden="true">
    <i />
    <i />
  </span>
);

const useAboutFonts = () => {
  useEffect(() => {
    if (document.querySelector(`link[href="${aboutFontsHref}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = aboutFontsHref;
    document.head.appendChild(link);
  }, []);
};

const AboutSitePage = () => {
  useAboutFonts();
  const audioRef = useRef(null);
  const pageRef = useRef(null);
  const physicsContainerRef = useRef(null);
  const copyNoticeTimerRef = useRef(0);
  const [now, setNow] = useState(() => new Date());
  const [bangumi, setBangumi] = useState([]);
  const [commits, setCommits] = useState({ items: [], repoCount: 0, state: "loading" });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [copyNotice, setCopyNotice] = useState("");

  const latestPost = useMemo(
    () =>
      [...blogPosts].sort((left, right) =>
        String(right.date || "").localeCompare(String(left.date || "")),
      )[0] || FALLBACK_POST,
    [],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(
    () => () => window.clearTimeout(copyNoticeTimerRef.current),
    [],
  );

  useEffect(() => {
    let alive = true;
    getGithubCommits()
      .then(({ items, repoCount }) => {
        if (!alive) return;
        setCommits({ items, repoCount, state: items.length ? "ready" : "empty" });
      })
      .catch(() => {
        if (alive) setCommits({ items: [], repoCount: 0, state: "error" });
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    getBangumiCollection("watching")
      .then(({ items }) => {
        if (alive) setBangumi(items.slice(0, 3));
      })
      .catch(() => {
        if (alive) setBangumi([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  };

  const seekBy = (offset) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + offset));
  };

  const copyContact = async (label, value) => {
    window.clearTimeout(copyNoticeTimerRef.current);
    try {
      await copyTextToClipboard(value);
      setCopyNotice(`${label}已复制到剪贴板`);
    } catch {
      setCopyNotice(`复制失败，请手动复制：${value}`);
    }
    copyNoticeTimerRef.current = window.setTimeout(() => setCopyNotice(""), 2400);
  };

  const fallbackBangumi = HERO_IMAGES.map((cover, index) => ({
    id: `fallback-${index}`,
    title: ["动画收藏", "正在追番", "心愿单"][index],
    coverUrl: cover,
  }));
  const bangumiItems = bangumi.length ? bangumi : fallbackBangumi;
  const clockValue = formatClock(now);

  useConstellationFit(pageRef, physicsContainerRef);
  useBubblePhysics(physicsContainerRef);

  return (
    <main ref={pageRef} className="about-desk-page" aria-label="关于我">
      <div className="about-desk-glow about-desk-glow-left" aria-hidden="true" />
      <div className="about-desk-glow about-desk-glow-right" aria-hidden="true" />

      <div ref={physicsContainerRef} className="about-desk-grid">
        <aside data-physics-bubble="journey" className="about-desk-card about-desk-journey about-desk-enter" aria-label="最近提交">
          <div className="about-desk-journey-head">
            <p>RECENT COMMITS</p>
            <strong>最近提交</strong>
            <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer" aria-label="打开 GitHub 主页">
              <FiArrowUpRight aria-hidden="true" />
            </a>
          </div>

          {commits.state === "ready" ? (
            <ol className="about-desk-journey-list">
              {commits.items.slice(0, COMMIT_ROWS).map((commit) => (
                <li key={commit.sha}>
                  <span>
                    {relativeCommitTime(commit.committedAt, now)}
                    <i>{shortRepoName(commit.repo)}</i>
                  </span>
                  <a href={commit.url} target="_blank" rel="noreferrer">
                    {commit.message}
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="about-desk-journey-empty">
              {commits.state === "loading" ? "正在读取提交记录…" : "提交记录暂时取不到"}
            </p>
          )}

          {commits.repoCount > 0 && (
            <p className="about-desk-journey-age">
              近期活跃于 <b>{commits.repoCount}</b> 个仓库
            </p>
          )}
        </aside>

        <section data-physics-bubble="collage" className="about-desk-card about-desk-collage about-desk-enter" aria-label="个人照片拼贴">
          <span className="about-desk-tape about-desk-tape-left" aria-hidden="true" />
          <span className="about-desk-tape about-desk-tape-right" aria-hidden="true" />
          <div className="about-desk-photo about-desk-photo-left">
            <img src={HERO_IMAGES[0]} alt="烟花下的动画插画" />
          </div>
          <div className="about-desk-photo about-desk-photo-main">
            <img src={HERO_IMAGES[1]} alt="蓝色海洋主题动画插画" />
          </div>
          <div className="about-desk-photo about-desk-photo-right">
            <img src={HERO_IMAGES[2]} alt="星空主题动画插画" />
          </div>
          <span className="about-desk-collage-note">MY LITTLE UNIVERSE</span>
        </section>

        <section data-physics-bubble="clock" className="about-desk-card about-desk-clock about-desk-enter" aria-label={`当前时间 ${clockValue}`}>
          <time className="sr-only" dateTime={now.toISOString()}>{clockValue}</time>
          <div className="about-desk-clock-face" aria-hidden="true">
            {renderClockDigit(clockValue[0], "hour-tens")}
            {renderClockDigit(clockValue[1], "hour-ones")}
            {renderClockColon()}
            {renderClockDigit(clockValue[3], "minute-tens")}
            {renderClockDigit(clockValue[4], "minute-ones")}
          </div>
        </section>

        <section data-physics-bubble="profile" className="about-desk-card about-desk-profile about-desk-enter">
          <div className="about-desk-profile-avatar">
            <img src="/github-avatar.png" alt="Yi-luo-hua 的头像" />
          </div>
          <h1 className="about-desk-greeting">
            <span>{greetingFor(now.getHours())}</span>
            <span>
              I&apos;m <b>{OWNER_NAME}</b>, Nice to meet you!
            </span>
          </h1>
        </section>

        <Link data-physics-bubble="album" className="about-desk-card about-desk-collection about-desk-album about-desk-enter" to="/gallery">
          <div className="about-desk-collection-copy">
            <span><FiImage aria-hidden="true" /> PHOTO ALBUM</span>
            <strong>我的相册</strong>
            <small>保存镜头里的片刻</small>
          </div>
          <div className="about-desk-thumbnails" aria-hidden="true">
            {galleryAlbums.slice(0, 3).map((album) => (
              <img key={album.id} src={album.cover} alt="" />
            ))}
          </div>
          <FiArrowUpRight className="about-desk-corner-icon" aria-hidden="true" />
        </Link>

        <Link data-physics-bubble="bangumi" className="about-desk-card about-desk-collection about-desk-bangumi about-desk-enter" to="/bangumi/watching">
          <div className="about-desk-collection-copy">
            <span><FiFilm aria-hidden="true" /> ANIME SHELF</span>
            <strong>番剧收藏</strong>
            <small>正在追与看过的故事</small>
          </div>
          <div className="about-desk-thumbnails" aria-hidden="true">
            {bangumiItems.slice(0, 3).map((item, index) => (
              <img
                key={item.id || item.title || index}
                src={resolveCoverSrc(item, API_BASE) || makePosterDataUri(item.title || "ANIME")}
                alt=""
              />
            ))}
          </div>
          <FiArrowUpRight className="about-desk-corner-icon" aria-hidden="true" />
        </Link>

        <nav className="about-desk-social" aria-label="社交链接">
          <a data-physics-bubble="github" className="about-desk-enter is-github" href="https://github.com/Yi-luo-hua" target="_blank" rel="noreferrer" aria-label="打开 GitHub 主页" title="GitHub">
            <span className="about-desk-social-icon"><FaGithub aria-hidden="true" /></span>
          </a>
          <a data-physics-bubble="bilibili" className="about-desk-enter is-bilibili" href="https://space.bilibili.com/313163065" target="_blank" rel="noreferrer" aria-label="打开 Bilibili 主页" title="Bilibili">
            <span className="about-desk-social-icon"><SiBilibili aria-hidden="true" /></span>
          </a>
          <a data-physics-bubble="pixiv" className="about-desk-enter is-pixiv" href={PIXIV_PROFILE} target="_blank" rel="noreferrer" aria-label="打开 Pixiv 主页" title="Pixiv">
            <span className="about-desk-social-icon"><SiPixiv aria-hidden="true" /></span>
          </a>
          <button
            data-physics-bubble="email"
            className="about-desk-enter is-email"
            type="button"
            title={EMAIL_ADDRESS}
            aria-label={`复制邮箱 ${EMAIL_ADDRESS}`}
            onClick={() => copyContact("邮箱", EMAIL_ADDRESS)}
          >
            <span className="about-desk-social-icon"><FiMail aria-hidden="true" /></span>
          </button>
          <button
            data-physics-bubble="qq"
            className="about-desk-enter is-qq"
            type="button"
            title={`QQ ${QQ_NUMBER}`}
            aria-label={`复制 QQ ${QQ_NUMBER}`}
            onClick={() => copyContact("QQ", QQ_NUMBER)}
          >
            <span className="about-desk-social-icon"><FaQq aria-hidden="true" /></span>
          </button>
          <span
            className={`about-desk-social-toast${copyNotice ? " is-visible" : ""}`}
            role="status"
            aria-live="polite"
          >
            {copyNotice}
          </span>
        </nav>

        <a data-physics-bubble="latest" className="about-desk-card about-desk-latest about-desk-enter" href={latestPost.url}>
          <div>
            <span><FiBookOpen aria-hidden="true" /> 最新文章</span>
            <strong>{latestPost.title}</strong>
            <small>{latestPost.dateLabel}</small>
          </div>
          <FiArrowUpRight aria-hidden="true" />
        </a>

        <a
          data-physics-bubble="project"
          className="about-desk-card about-desk-project about-desk-enter"
          href={FEATURED_PROJECT.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span><FiCode aria-hidden="true" /> MY PROJECT</span>
          <strong>{FEATURED_PROJECT.name}</strong>
          <small>{FEATURED_PROJECT.description}</small>
          <FiArrowUpRight aria-hidden="true" />
        </a>

        <section data-physics-bubble="player" className="about-desk-card about-desk-player about-desk-enter" aria-label="音乐播放器">
          <audio
            ref={audioRef}
            src={MUSIC_SRC}
            preload="metadata"
            loop
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          <div className="about-desk-album-art" aria-hidden="true">
            <img src={HERO_IMAGES[2]} alt="" />
            <FiMusic />
          </div>
          <div className="about-desk-player-main">
            <div className="about-desk-track-title">
              <div>
                <strong>{"it's 6pm but I miss u already"}</strong>
                <span>YaoNie</span>
              </div>
              <FiVolume2 aria-hidden="true" />
            </div>
            <label className="about-desk-scrubber">
              <span className="sr-only">音乐播放进度</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => {
                  if (!audioRef.current) return;
                  audioRef.current.currentTime = Number(event.target.value);
                  setCurrentTime(Number(event.target.value));
                }}
              />
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
            </label>
          </div>
          <div className="about-desk-player-controls">
            <button type="button" onClick={() => seekBy(-10)} aria-label="后退 10 秒"><FiSkipBack /></button>
            <button type="button" className="is-primary" onClick={togglePlayback} aria-label={isPlaying ? "暂停" : "播放"}>
              {isPlaying ? <FiPause /> : <FiPlay />}
            </button>
            <button type="button" onClick={() => seekBy(10)} aria-label="前进 10 秒"><FiSkipForward /></button>
          </div>
        </section>

      </div>
    </main>
  );
};

export default AboutSitePage;

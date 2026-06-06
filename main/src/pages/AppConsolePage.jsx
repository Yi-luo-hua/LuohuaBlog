import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiBell, FiRefreshCw, FiX } from "react-icons/fi";
import { authMe } from "../services/authApi";
import { fetchChatStats } from "../services/chatStatsApi";
import {
  buildMobileArticleDraft,
  getNotificationTotal,
  ownerConsoleAvatars,
  ownerConsoleModules,
  ownerConsoleNotifications,
  ownerConsoleScreens,
  publishSteps,
} from "../pwa/appConsoleBlueprint";
import {
  getBackendHealthLabel,
  getOwnerSessionLabel,
  getStatsSnapshot,
} from "../pwa/appConsoleState";

const screenMap = Object.fromEntries(ownerConsoleScreens.map((screen) => [screen.id, screen]));

const articleSeed = `---
title: 站点控制器外观确认记录
date: 2026-06-06 19:20:00
tags: [网站, 控制器]
categories: [建站]
---

# 站点控制器外观确认记录

今天先把站长控制器的外观做出来。

- 浅色系
- 高级透明磨砂质感
- 支持文章、相册、友链、留言、AI 状态

图片可以直接拖入编辑器，正式版会自动上传并替换为 COS 链接。`;

const defaultMobileMaterial =
  "今天调整了站长控制器：电脑端保留 Markdown，手机端交给 AI 代理写文章，还能审核后发布。";

const initialCandidateAnswers = [
  "这是站长预设的 AI 助手，会优先读取固定答案库；没有命中时才进入待处理区。",
  "这个网站助手由站长后台维护，常见问题会被整理成固定答案，保证回复稳定。",
  "你可以把它理解为网站的问答控制器：先调试，再把满意回答发布给用户。",
];

const initialFixedAnswers = [
  {
    question: "如何交换友链？",
    answer: "请在朋友页留言站点名称、链接、头像和描述，站长审核后会加入友链。",
  },
  {
    question: "网站 AI 助手怎么做？",
    answer: "站长会先在后台调试答案，保存后用户看到的是固定回复。",
  },
  {
    question: "相册图片从哪里来？",
    answer: "图片由站长上传到对象存储，再同步到 Gallery 页面展示。",
  },
];

const fetchBackendHealth = async () => {
  const res = await fetch("/api/v1/health", {
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
};

const triggerBackendSync = async () => {
  const res = await fetch("/api/v1/sync/trigger", {
    method: "POST",
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
  return data;
};

const moduleToneClass = {
  blue: "owner-module-icon owner-module-icon--blue",
  green: "owner-module-icon owner-module-icon--green",
  rose: "owner-module-icon owner-module-icon--rose",
  sun: "owner-module-icon owner-module-icon--sun",
};

const StatusTag = ({ children }) => <span className="owner-tag">{children}</span>;

const AppConsolePage = () => {
  const [activeScreen, setActiveScreen] = useState("home");
  const [auth, setAuth] = useState(null);
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatar, setAvatar] = useState(ownerConsoleAvatars[0]);
  const [articleTitle, setArticleTitle] = useState("站点控制器外观确认记录");
  const [articleBody, setArticleBody] = useState(articleSeed);
  const [friendName, setFriendName] = useState("KoBariDev");
  const [friendDesc, setFriendDesc] = useState("Ciallo～");
  const [mobileMaterial, setMobileMaterial] = useState(defaultMobileMaterial);
  const [mobileDraft, setMobileDraft] = useState({
    title: "待生成文章",
    body: "点击“让 AI 写草稿”后，这里会出现标题、摘要和正文结构。",
  });
  const [mobileToast, setMobileToast] = useState(
    "把图片和文字交给 AI，它会先生成一篇待审核文章。",
  );
  const [aiQuestion, setAiQuestion] = useState("网站 AI 助手是怎么做出来的？");
  const [candidateAnswers, setCandidateAnswers] = useState(initialCandidateAnswers);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(0);
  const [manualAnswer, setManualAnswer] = useState("");
  const [fixedAnswers, setFixedAnswers] = useState(initialFixedAnswers);
  const [answerToast, setAnswerToast] = useState("");
  const [publishState, setPublishState] = useState({
    open: false,
    title: "发布任务",
    activeIndex: -1,
    failIndex: null,
    toast: "点击发布后，这里会显示每一步状态。失败不会影响线上旧版本。",
  });
  const publishTimerRef = useRef(null);

  const loadConsole = useCallback(async () => {
    setError("");
    const [authResult, healthResult, statsResult] = await Promise.allSettled([
      authMe(),
      fetchBackendHealth(),
      fetchChatStats(14),
    ]);

    if (authResult.status === "fulfilled") {
      setAuth(authResult.value.ok ? authResult.value.data : { loggedIn: false });
    }
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    if (statsResult.status === "fulfilled") setStats(statsResult.value);

    const failed = [authResult, healthResult, statsResult].some(
      (result) => result.status === "rejected",
    );
    if (failed) setError("部分后端信号暂时不可用，检查 /api 后可以重试。");
  }, []);

  useEffect(() => {
    loadConsole();
    return () => {
      if (publishTimerRef.current) clearInterval(publishTimerRef.current);
    };
  }, [loadConsole]);

  const activeMeta = screenMap[activeScreen] || screenMap.home;
  const ownerLabel = getOwnerSessionLabel(auth);
  const healthLabel = getBackendHealthLabel(health);
  const statsSnapshot = useMemo(() => getStatsSnapshot(stats), [stats]);
  const notificationTotal = getNotificationTotal(ownerConsoleNotifications);
  const previewBody = useMemo(
    () => articleBody.replaceAll("---", "").trim().slice(0, 420) || "Markdown 预览",
    [articleBody],
  );

  const openScreen = (screenId) => {
    setActiveScreen(screenId);
    setNotificationsOpen(false);
    setAvatarOpen(false);
  };

  const clearPublishTimer = () => {
    if (publishTimerRef.current) {
      clearInterval(publishTimerRef.current);
      publishTimerRef.current = null;
    }
  };

  const startPublish = (title) => {
    clearPublishTimer();
    setPublishState({
      open: true,
      title,
      activeIndex: 0,
      failIndex: null,
      toast: "任务已开始。失败时不会影响线上旧版本。",
    });

    let step = 0;
    publishTimerRef.current = setInterval(() => {
      step += 1;
      if (step >= publishSteps.length) {
        clearPublishTimer();
        setPublishState((current) => ({
          ...current,
          activeIndex: publishSteps.length,
          failIndex: null,
          toast: "发布模拟完成：线上链接已生成，可以复制或继续发布。",
        }));
        return;
      }
      setPublishState((current) => ({ ...current, activeIndex: step, failIndex: null }));
    }, 760);
  };

  const simulateFail = () => {
    clearPublishTimer();
    setPublishState((current) => ({
      ...current,
      open: true,
      activeIndex: 2,
      failIndex: 2,
      toast: "模拟失败：生成页面失败。线上网站保持上一版，可以修改草稿后重试。",
    }));
  };

  const closePublish = () => {
    clearPublishTimer();
    setPublishState((current) => ({ ...current, open: false }));
  };

  const fakeSave = () => {
    clearPublishTimer();
    setPublishState({
      open: true,
      title: "保存草稿",
      activeIndex: -1,
      failIndex: null,
      toast: "草稿已保存。",
    });
  };

  const generateMobileArticle = () => {
    const draft = buildMobileArticleDraft(mobileMaterial);
    setMobileDraft(draft);
    setMobileToast("AI 已生成待审核草稿，可以修改素材后重写，也可以审核通过并发布。");
  };

  const approveMobileArticle = () => {
    if (mobileDraft.title === "待生成文章") {
      setMobileDraft(buildMobileArticleDraft(mobileMaterial));
    }
    setMobileToast("已审核通过，正在交给自动化发布流程。");
    startPublish("手机 AI 代理发布文章");
  };

  const testAiQuestion = () => {
    const question = aiQuestion.trim() || "用户问题";
    setCandidateAnswers([
      `关于“${question}”，建议使用站长已经确认过的固定答案；用户侧会优先展示这条回复。`,
      "这个问题可以沉淀为固定问答：先由站长调试答案，再保存到答案库，之后稳定输出给用户。",
      "如果当前没有满意答案，就在手动答案区补一条，保存后下次同类问题直接命中。",
    ]);
    setSelectedAnswerIndex(0);
    setAnswerToast("已生成 3 条候选答案。");
  };

  const saveFixedAnswer = () => {
    const question = aiQuestion.trim() || "未命名问题";
    const answer = manualAnswer.trim() || candidateAnswers[selectedAnswerIndex] || "";
    if (!answer) {
      setAnswerToast("请先选择候选答案，或手动填写最终答案。");
      return;
    }
    setFixedAnswers((current) => [{ question, answer }, ...current]);
    setManualAnswer("");
    setAnswerToast("已保存。用户再问相似问题时，将优先输出这条固定答案。");
  };

  const handleSync = async () => {
    try {
      await triggerBackendSync();
      startPublish("刷新 Bili 缓存");
    } catch (e) {
      setError(e.message || "同步触发失败");
      simulateFail();
    }
  };

  return (
    <main className="owner-console">
      <div className="owner-console-app">
        <aside className="owner-console-sidebar owner-glass" aria-label="Owner console sections">
          <button
            type="button"
            className="owner-brand"
            onClick={() => openScreen("home")}
            aria-label="打开站长工作台"
          >
            <span className="owner-brand-mark">TC</span>
            <span>
              <strong>Taozhiyy Control</strong>
              <small>站长创作工作台</small>
            </span>
          </button>
          <nav className="owner-nav">
            {ownerConsoleScreens.map((screen) => (
              <button
                type="button"
                key={screen.id}
                className={activeScreen === screen.id ? "active" : ""}
                onClick={() => openScreen(screen.id)}
              >
                <span className="owner-nav-icon">{screen.icon}</span>
                <span>{screen.navLabel}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="owner-workspace">
          <header className="owner-topbar owner-glass">
            <div>
              <h1 className="owner-page-title">{activeMeta.title}</h1>
              <p className="owner-page-sub">{activeMeta.subtitle}</p>
            </div>
            <div className="owner-top-actions">
              <span className="owner-pill">
                <span className="owner-status-dot" />
                最近发布：等待任务
              </span>
              <div className="owner-notify-wrap">
                <button
                  type="button"
                  className="owner-icon-button"
                  onClick={() => {
                    setNotificationsOpen((open) => !open);
                    setAvatarOpen(false);
                  }}
                  aria-label="消息提醒"
                >
                  <FiBell aria-hidden />
                  <span className="owner-badge">{notificationTotal}</span>
                </button>
                {notificationsOpen ? (
                  <div className="owner-popover owner-glass">
                    <div className="owner-panel-title">
                      <h2>消息提醒</h2>
                      <StatusTag>{notificationTotal}</StatusTag>
                    </div>
                    <div className="owner-notice-list">
                      {ownerConsoleNotifications.map((item) => (
                        <button
                          type="button"
                          key={item.title}
                          className="owner-notice"
                          onClick={() => openScreen("inbox")}
                        >
                          <span className="owner-dot" />
                          <span>
                            <strong>{item.title}</strong>
                            <small>{item.detail}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="owner-avatar-wrap">
                <button
                  type="button"
                  className="owner-avatar-button"
                  onClick={() => {
                    setAvatarOpen((open) => !open);
                    setNotificationsOpen(false);
                  }}
                  aria-label="切换头像"
                >
                  <span className="owner-avatar-face" style={{ background: avatar.gradient }}>
                    {avatar.initial}
                  </span>
                </button>
                {avatarOpen ? (
                  <div className="owner-avatar-switcher owner-glass">
                    <div className="owner-panel-title">
                      <h2>切换头像</h2>
                      <StatusTag>本地预览</StatusTag>
                    </div>
                    <div className="owner-avatar-grid">
                      {ownerConsoleAvatars.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`owner-avatar-option ${
                            item.id === avatar.id ? "active" : ""
                          }`}
                          onClick={() => {
                            setAvatar(item);
                            setAvatarOpen(false);
                          }}
                        >
                          <span
                            className="owner-avatar-face"
                            style={{ background: item.gradient }}
                          >
                            {item.initial}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                      <button type="button" className="owner-avatar-option owner-avatar-upload">
                        上传头像
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {error ? <p className="owner-alert">{error}</p> : null}

          <section className={`owner-screen ${activeScreen === "home" ? "active" : ""}`}>
            <div className="owner-content-grid">
              <div className="owner-home-main">
                <div className="owner-section-title">
                  <div>
                    <h2>常用操作</h2>
                    <p>直接进入日常维护任务。</p>
                  </div>
                  <StatusTag>Today</StatusTag>
                </div>
                <div className="owner-module-grid">
                  {ownerConsoleModules.map((module) => (
                    <button
                      type="button"
                      key={module.id}
                      className="owner-module-card"
                      onClick={() => openScreen(module.id)}
                    >
                      <span className="owner-module-head">
                        <span>
                          <strong>{module.title}</strong>
                          <small>{module.description}</small>
                        </span>
                        <span className={moduleToneClass[module.tone]}>{module.icon}</span>
                      </span>
                      <span className="owner-tiny-status">{module.status}</span>
                    </button>
                  ))}
                </div>

                <section className="owner-panel owner-glass">
                  <div className="owner-panel-title">
                    <h2>访问与用户</h2>
                    <StatusTag>模拟数据</StatusTag>
                  </div>
                  <div className="owner-stats-grid">
                    <article className="owner-stat-card">
                      <span>今日访问</span>
                      <strong>1,284</strong>
                      <em>+12%</em>
                    </article>
                    <article className="owner-stat-card">
                      <span>总访问量</span>
                      <strong>86.3k</strong>
                      <em>稳定</em>
                    </article>
                    <article className="owner-stat-card">
                      <span>注册用户</span>
                      <strong>27</strong>
                      <em>+1 新增</em>
                    </article>
                    <article className="owner-stat-card">
                      <span>AI 调用</span>
                      <strong>{statsSnapshot.today}</strong>
                      <em>{statsSnapshot.model}</em>
                    </article>
                  </div>
                </section>

                <section className="owner-panel owner-glass">
                  <div className="owner-panel-title">
                    <h2>注册用户</h2>
                    <button type="button" className="owner-secondary owner-small-button">
                      查看全部
                    </button>
                  </div>
                  <div className="owner-user-list">
                    <div className="owner-user-row">
                      <span className="owner-user-avatar">O</span>
                      <span>
                        <strong>{ownerLabel}</strong>
                        <small>Owner session · {healthLabel}</small>
                      </span>
                      <StatusTag>Owner</StatusTag>
                    </div>
                    <div className="owner-user-row">
                      <span className="owner-user-avatar">M</span>
                      <span>
                        <strong>MisakaFan</strong>
                        <small>最近登录：今天 14:22</small>
                      </span>
                      <StatusTag>User</StatusTag>
                    </div>
                    <div className="owner-user-row">
                      <span className="owner-user-avatar">K</span>
                      <span>
                        <strong>KoBariDev</strong>
                        <small>最近登录：昨天 21:08</small>
                      </span>
                      <StatusTag>User</StatusTag>
                    </div>
                  </div>
                </section>
              </div>

              <aside className="owner-side-stack">
                <section className="owner-panel owner-glass">
                  <div className="owner-panel-title">
                    <h2>消息提醒</h2>
                    <StatusTag>{notificationTotal}</StatusTag>
                  </div>
                  <div className="owner-notice-list">
                    {ownerConsoleNotifications.map((item) => (
                      <button
                        type="button"
                        key={item.title}
                        className="owner-notice"
                        onClick={() => openScreen("inbox")}
                      >
                        <span className="owner-dot" />
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="owner-panel owner-glass">
                  <div className="owner-panel-title">
                    <h2>发布任务</h2>
                    <StatusTag>模拟</StatusTag>
                  </div>
                  <div className="owner-task-list">
                    <div className="owner-task-row">
                      <span>上一版线上状态</span>
                      <strong>正常</strong>
                    </div>
                    <div className="owner-task-row">
                      <span>当前草稿</span>
                      <strong>2</strong>
                    </div>
                    <div className="owner-task-row">
                      <span>诊断中心</span>
                      <strong>可查看</strong>
                    </div>
                  </div>
                  <button type="button" className="owner-secondary" onClick={handleSync}>
                    <FiRefreshCw aria-hidden /> 刷新后端信号
                  </button>
                </section>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "article" ? "active" : ""}`}>
            <div className="owner-form-shell owner-glass owner-desktop-article">
              <div>
                <div className="owner-field">
                  <label htmlFor="articleType">文章模块</label>
                  <select id="articleType">
                    <option>Blog 文章</option>
                    <option>Build 记录</option>
                  </select>
                </div>
                <div className="owner-field">
                  <label htmlFor="articleTitle">标题</label>
                  <input
                    id="articleTitle"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                  />
                </div>
                <p className="owner-frontmatter-hint">
                  Markdown 模式：正式版会自动生成 frontmatter，你也可以手动编辑 tags、
                  categories、cover 等字段。
                </p>
                <div className="owner-md-editor">
                  <div className="owner-md-toolbar">
                    {["H1", "B", "I", "Link", "Img", "Code"].map((tool) => (
                      <button type="button" key={tool}>
                        {tool}
                      </button>
                    ))}
                    <span>.md</span>
                  </div>
                  <textarea value={articleBody} onChange={(e) => setArticleBody(e.target.value)} />
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary" onClick={fakeSave}>
                    保存草稿
                  </button>
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={() => startPublish("发布文章")}
                  >
                    发布到网站
                  </button>
                </div>
              </div>
              <aside className="owner-md-preview">
                <div className="owner-kicker">Markdown Preview</div>
                <div className="owner-cover">封面预览</div>
                <h2>{articleTitle || "未命名文章"}</h2>
                <pre>{previewBody}</pre>
              </aside>
            </div>

            <div className="owner-mobile-article">
              <section className="owner-agent-card owner-glass">
                <div className="owner-panel-title">
                  <h2>手机 AI 代理发文章</h2>
                  <StatusTag>移动端</StatusTag>
                </div>
                <div className="owner-agent-steps">
                  <div>
                    <b>1. 交素材</b>
                    <span>把图片和零散文字交给 AI。</span>
                  </div>
                  <div>
                    <b>2. AI 成文</b>
                    <span>自动整理标题、正文和发布摘要。</span>
                  </div>
                  <div>
                    <b>3. 审核发布</b>
                    <span>你确认后进入自动化发布流程。</span>
                  </div>
                </div>
                <div className="owner-agent-dropzone">
                  <strong>添加图片</strong>
                  <span>原型中用占位素材；正式版会上传图片并交给 AI 组织内容。</span>
                </div>
                <div className="owner-field">
                  <label htmlFor="mobileArticleInput">给 AI 的文字素材</label>
                  <textarea
                    id="mobileArticleInput"
                    value={mobileMaterial}
                    onChange={(e) => setMobileMaterial(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary" onClick={generateMobileArticle}>
                    让 AI 写草稿
                  </button>
                  <button type="button" className="owner-primary" onClick={approveMobileArticle}>
                    审核通过并发布
                  </button>
                </div>
                <p className="owner-agent-toast">{mobileToast}</p>
              </section>
              <aside className="owner-agent-preview owner-glass">
                <div className="owner-kicker">AI Draft Preview</div>
                <div className="owner-cover">素材封面</div>
                <h2>{mobileDraft.title}</h2>
                <pre>{mobileDraft.body}</pre>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "drafts" ? "active" : ""}`}>
            <div className="owner-panel owner-glass">
              <div className="owner-panel-title">
                <h2>草稿箱</h2>
                <button
                  type="button"
                  className="owner-primary owner-small-button"
                  onClick={() => openScreen("article")}
                >
                  新建文章
                </button>
              </div>
              <div className="owner-mini-metrics">
                <div>
                  <span>文章草稿</span>
                  <b>2</b>
                </div>
                <div>
                  <span>图片草稿</span>
                  <b>0</b>
                </div>
                <div>
                  <span>待补封面</span>
                  <b>1</b>
                </div>
                <div>
                  <span>可发布</span>
                  <b>1</b>
                </div>
              </div>
              <div className="owner-draft-list">
                {[
                  ["站点控制器外观确认记录", "Blog 文章 · 保存于今天 19:20 · 已有 Markdown 正文"],
                  ["AI 固定答案配置说明", "Build 记录 · 保存于昨天 23:14 · 缺少封面图"],
                ].map(([title, detail], index) => (
                  <article className="owner-draft-item" key={title}>
                    <span>
                      <strong>{title}</strong>
                      <small>{detail}</small>
                    </span>
                    <span className="owner-quick-line">
                      <button
                        type="button"
                        className="owner-secondary"
                        onClick={() => openScreen("article")}
                      >
                        继续编辑
                      </button>
                      <button
                        type="button"
                        className={index === 0 ? "owner-primary" : "owner-secondary"}
                        onClick={() => startPublish(index === 0 ? "发布草稿" : "归档草稿")}
                      >
                        {index === 0 ? "发布" : "归档"}
                      </button>
                    </span>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "gallery" ? "active" : ""}`}>
            <div className="owner-form-shell owner-glass">
              <div>
                <div className="owner-field">
                  <label htmlFor="galleryAlbum">选择相册</label>
                  <select id="galleryAlbum">
                    <option>御坂美琴</option>
                    <option>春物</option>
                    <option>唐舞麟</option>
                    <option>新建相册</option>
                  </select>
                </div>
                <div className="owner-dropzone">
                  <strong>拖入图片或点击选择</strong>
                  <span>原型中先展示模拟缩略图；正式版会上传到 COS 并更新 Gallery 数据。</span>
                </div>
                <div className="owner-thumb-grid">
                  <span>IMG 01</span>
                  <span>IMG 02</span>
                  <span>IMG 03</span>
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary">
                    仅上传为草稿
                  </button>
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={() => startPublish("上传 Gallery 图片")}
                  >
                    上传并发布
                  </button>
                </div>
              </div>
              <aside className="owner-preview-card">
                <div className="owner-kicker">Album Preview</div>
                <div className="owner-cover">相册封面</div>
                <h2>将新增 3 张图片</h2>
                <p>发布后会自动上传图片、写入相册数据，并触发构建部署。</p>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "friend" ? "active" : ""}`}>
            <div className="owner-form-shell owner-glass">
              <div>
                <div className="owner-field">
                  <label htmlFor="friendName">站点名称</label>
                  <input
                    id="friendName"
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                  />
                </div>
                <div className="owner-field">
                  <label htmlFor="friendUrl">站点链接</label>
                  <input id="friendUrl" defaultValue="https://hub.131714.xyz/" />
                </div>
                <div className="owner-field">
                  <label htmlFor="friendDesc">描述</label>
                  <textarea
                    id="friendDesc"
                    value={friendDesc}
                    onChange={(e) => setFriendDesc(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary">
                    校验链接
                  </button>
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={() => startPublish("增加友链")}
                  >
                    发布友链
                  </button>
                </div>
              </div>
              <aside className="owner-preview-card">
                <div className="owner-kicker">Friend Card</div>
                <div className="owner-friend-preview">
                  <span>K</span>
                  <div>
                    <h2>{friendName || "站点名称"}</h2>
                    <p>{friendDesc || "站点描述"}</p>
                  </div>
                </div>
                <p>正式版会校验头像、链接和必填字段。</p>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "inbox" ? "active" : ""}`}>
            <div className="owner-panel owner-glass">
              <div className="owner-panel-title">
                <h2>统一留言收件箱</h2>
                <StatusTag>{notificationTotal} 条提醒</StatusTag>
              </div>
              <div className="owner-inbox-list">
                {ownerConsoleNotifications.map((item) => (
                  <article className="owner-message" key={item.title}>
                    <div className="owner-message-head">
                      <strong>{item.title}</strong>
                      <StatusTag>{item.source}</StatusTag>
                    </div>
                    <p>{item.detail}</p>
                    <div className="owner-quick-line">
                      <button type="button" className="owner-secondary">
                        回复
                      </button>
                      <button type="button" className="owner-secondary">
                        标记已读
                      </button>
                      {item.source === "申请" ? (
                        <button
                          type="button"
                          className="owner-primary"
                          onClick={() => openScreen("friend")}
                        >
                          带入友链
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "ai" ? "active" : ""}`}>
            <div className="owner-panel owner-glass">
              <div className="owner-panel-title">
                <h2>用户统计表</h2>
                <StatusTag>今日 AI 使用</StatusTag>
              </div>
              <div className="owner-mini-metrics">
                <div>
                  <span>今日提问</span>
                  <b>{statsSnapshot.today}</b>
                </div>
                <div>
                  <span>固定命中</span>
                  <b>31</b>
                </div>
                <div>
                  <span>待补答案</span>
                  <b>5</b>
                </div>
                <div>
                  <span>异常反馈</span>
                  <b>0</b>
                </div>
              </div>
              <div className="owner-table-wrap">
                <table className="owner-data-table">
                  <thead>
                    <tr>
                      <th>用户</th>
                      <th>最近问题</th>
                      <th>提问</th>
                      <th>固定命中</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>MisakaFan</td>
                      <td>网站 AI 助手怎么做？</td>
                      <td>12</td>
                      <td>9</td>
                      <td>
                        <StatusTag>正常</StatusTag>
                      </td>
                    </tr>
                    <tr>
                      <td>KoBariDev</td>
                      <td>如何交换友链？</td>
                      <td>7</td>
                      <td>7</td>
                      <td>
                        <StatusTag>高命中</StatusTag>
                      </td>
                    </tr>
                    <tr>
                      <td>Guest-1024</td>
                      <td>站点控制器是什么？</td>
                      <td>4</td>
                      <td>1</td>
                      <td>
                        <StatusTag>待补</StatusTag>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="owner-ai-workbench">
              <section className="owner-debug-box owner-glass">
                <div className="owner-panel-title">
                  <h2>AI 调试区</h2>
                  <StatusTag>先调试，再固定</StatusTag>
                </div>
                <div className="owner-field">
                  <label htmlFor="aiQuestion">测试问题</label>
                  <textarea
                    id="aiQuestion"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary" onClick={testAiQuestion}>
                    生成候选
                  </button>
                  <button type="button" className="owner-primary" onClick={saveFixedAnswer}>
                    保存为固定答案
                  </button>
                </div>
                <div className="owner-panel-title owner-panel-title--spaced">
                  <h2>候选答案</h2>
                  <StatusTag>选择满意的一条</StatusTag>
                </div>
                <div className="owner-candidate-list">
                  {candidateAnswers.map((answer, index) => (
                    <button
                      type="button"
                      key={answer}
                      className={selectedAnswerIndex === index ? "selected" : ""}
                      onClick={() => {
                        setSelectedAnswerIndex(index);
                        setAnswerToast("已选择候选答案，可以直接保存为固定回复。");
                      }}
                    >
                      {answer}
                    </button>
                  ))}
                </div>
                <div className="owner-field owner-field--spaced">
                  <label htmlFor="manualAnswer">手动补充或改写答案</label>
                  <textarea
                    id="manualAnswer"
                    placeholder="没有满意候选时，在这里写最终要给用户看到的固定答案。"
                    value={manualAnswer}
                    onChange={(e) => setManualAnswer(e.target.value)}
                  />
                </div>
                <p className="owner-answer-toast">{answerToast}</p>
              </section>

              <aside className="owner-debug-box owner-glass">
                <div className="owner-panel-title">
                  <h2>固定答案库</h2>
                  <StatusTag>用户输出</StatusTag>
                </div>
                <div className="owner-fixed-list">
                  {fixedAnswers.map((item) => (
                    <article key={`${item.question}-${item.answer}`}>
                      <strong>{item.question}</strong>
                      <p>{item.answer}</p>
                    </article>
                  ))}
                </div>
              </aside>
            </div>
          </section>
        </section>
      </div>

      <nav className="owner-bottom-nav" aria-label="Mobile owner console sections">
        {ownerConsoleScreens
          .filter((screen) => screen.id !== "friend")
          .map((screen) => (
            <button
              type="button"
              key={screen.id}
              className={activeScreen === screen.id ? "active" : ""}
              onClick={() => openScreen(screen.id)}
            >
              {screen.navLabel.replace("发", "")}
            </button>
          ))}
      </nav>

      <div className={`owner-drawer ${publishState.open ? "open" : ""}`}>
        <div className="owner-drawer-panel owner-glass">
          <div className="owner-drawer-head">
            <div>
              <div className="owner-kicker">Publish Flow</div>
              <h2>{publishState.title}</h2>
            </div>
            <button type="button" className="owner-close" onClick={closePublish} aria-label="关闭">
              <FiX aria-hidden />
            </button>
          </div>
          <div className="owner-step-list">
            {publishSteps.map((step, index) => {
              const done = index < publishState.activeIndex;
              const active = index === publishState.activeIndex;
              const failed = index === publishState.failIndex;
              return (
                <div
                  key={step}
                  className={[
                    "owner-step",
                    done ? "done" : "",
                    active ? "active" : "",
                    failed ? "fail" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className="owner-step-no">{index + 1}</span>
                  <span>
                    <strong>{step}</strong>
                    <small>
                      {failed
                        ? "线上旧版本不受影响"
                        : active
                          ? "正在处理，请稍等"
                          : done
                            ? "这一步已经处理完成"
                            : "后台自动处理"}
                    </small>
                  </span>
                  <em>{failed ? "失败" : done ? "已完成" : active ? "进行中" : "等待中"}</em>
                </div>
              );
            })}
          </div>
          <p className="owner-toast">{publishState.toast}</p>
          <div className="owner-quick-line">
            <button type="button" className="owner-secondary" onClick={simulateFail}>
              模拟失败
            </button>
            <button
              type="button"
              className="owner-primary"
              onClick={() => startPublish(publishState.title || "重新发布")}
            >
              重新模拟
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default AppConsolePage;

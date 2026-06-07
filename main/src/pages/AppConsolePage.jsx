import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiBell, FiRefreshCw, FiUpload, FiX } from "react-icons/fi";
import { authMe } from "../services/authApi";
import { fetchChatStats } from "../services/chatStatsApi";
import {
  createOwnerDraft,
  fetchOwnerStatus,
  isPublicImageURL,
  publishOwnerArticle,
  uploadOwnerAsset,
} from "../services/ownerApi";
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
import {
  ownerCustomGalleryAlbumValue,
  ownerGalleryAlbumOptions,
  resolveOwnerGalleryAlbum,
} from "../lib/ownerGalleryAlbums";

const screenMap = Object.fromEntries(ownerConsoleScreens.map((screen) => [screen.id, screen]));

const articleSeed = `---
title: 站长控制器第一阶段接站记录
date: 2026-06-07 01:10:00
tags: [网站, 控制台]
categories: [建站]
---

# 站长控制器第一阶段接站记录

这一版开始把 App 控制台接到真实站点数据：

- 真实 owner 状态
- 真实图片上传
- 真实 Markdown 草稿
- 真实留言提醒与 AI 统计
`;

const defaultMobileMaterial =
  "今天把手机端 AI 发文流程接到真实草稿接口，图片和文字都能先保存到站长控制台。";

const initialCandidateAnswers = [
  "这是站长控制台里的 AI 调试区，当前仍是本地原型回答区，后续再接真实固定问答库。",
  "这块功能的目标是先调试满意答案，再决定是否发布给用户使用，目前先保留原型交互。",
  "第一阶段先把数据接通，AI 固定回答库会放到后续阶段继续做。",
];

const initialFixedAnswers = [
  {
    question: "如何交换友链？",
    answer: "可以先在友链页留言申请，控制台会在后续阶段接入真实审批和写库流程。",
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

const draftDetail = (item) => {
  const kind = item.kind || "article";
  const updatedAt = item.updatedAt || item.createdAt || "";
  const bodyBytes = new TextEncoder().encode(item.body || "").length;
  return `${kind} · ${updatedAt || "just now"} · ${bodyBytes} bytes`;
};

const userInitial = (name) => (name || "?").slice(0, 1).toUpperCase();

const AppConsolePage = () => {
  const [activeScreen, setActiveScreen] = useState("home");
  const [auth, setAuth] = useState(null);
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [ownerStatus, setOwnerStatus] = useState(null);
  const [error, setError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [avatar, setAvatar] = useState(ownerConsoleAvatars[0]);
  const [articleTitle, setArticleTitle] = useState("站长控制器第一阶段接站记录");
  const [articleBody, setArticleBody] = useState(articleSeed);
  const [articleImageURL, setArticleImageURL] = useState("");
  const [friendName, setFriendName] = useState("KoBariDev");
  const [friendDesc, setFriendDesc] = useState("Ciallo");
  const [mobileMaterial, setMobileMaterial] = useState(defaultMobileMaterial);
  const [mobileDraft, setMobileDraft] = useState({
    title: "待生成文章",
    body: "点击“让 AI 写草稿”后，这里会出现移动端文章草稿。",
  });
  const [mobileToast, setMobileToast] = useState(
    "把图片和文字交给 AI 后，第一阶段会先保存为真实草稿，不直接发线上。",
  );
  const [aiQuestion, setAiQuestion] = useState("网站 AI 助手是怎么做出来的？");
  const [candidateAnswers, setCandidateAnswers] = useState(initialCandidateAnswers);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(0);
  const [manualAnswer, setManualAnswer] = useState("");
  const [fixedAnswers, setFixedAnswers] = useState(initialFixedAnswers);
  const [answerToast, setAnswerToast] = useState("");
  const [galleryAlbum, setGalleryAlbum] = useState(ownerGalleryAlbumOptions[0]?.value || "");
  const [customGalleryAlbum, setCustomGalleryAlbum] = useState("");
  const [galleryURLInput, setGalleryURLInput] = useState("");
  const [galleryUploads, setGalleryUploads] = useState([]);
  const [saveBusy, setSaveBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [articleUploadBusy, setArticleUploadBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [publishState, setPublishState] = useState({
    open: false,
    title: "Publish Task",
    activeIndex: -1,
    failIndex: null,
    simulated: false,
    toast: "第一阶段主要提供真实上传和真实草稿，不直接改线上正式内容。",
  });
  const publishTimerRef = useRef(null);

  const loadConsole = useCallback(async () => {
    setError("");
    const [authResult, healthResult, statsResult, ownerStatusResult] = await Promise.allSettled([
      authMe(),
      fetchBackendHealth(),
      fetchChatStats(14),
      fetchOwnerStatus(),
    ]);

    if (authResult.status === "fulfilled") {
      setAuth(authResult.value.ok ? authResult.value.data : { loggedIn: false });
    }
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    if (statsResult.status === "fulfilled") setStats(statsResult.value);
    if (ownerStatusResult.status === "fulfilled") setOwnerStatus(ownerStatusResult.value);

    const requiredFailures = [authResult, healthResult, statsResult].some(
      (result) => result.status === "rejected",
    );
    if (requiredFailures) {
      setError("部分后端信号暂时不可用，可以继续操作草稿与原型区。");
    }
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
  const liveNotifications = ownerStatus?.notifications?.items || ownerConsoleNotifications;
  const notificationTotal =
    ownerStatus?.notifications?.total ?? getNotificationTotal(ownerConsoleNotifications);
  const liveUsers = ownerStatus?.users?.latest || [];
  const liveDrafts = ownerStatus?.drafts?.items || [];
  const draftCount = ownerStatus?.drafts?.total ?? liveDrafts.length;
  const previewBody = useMemo(
    () => articleBody.replaceAll("---", "").trim().slice(0, 420) || "Markdown preview",
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
      simulated: true,
      toast: "这里只模拟发布流程；第一阶段真实完成的是草稿和上传。",
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
          simulated: true,
          toast: "模拟发布完成。正式一键发布会放到后续阶段。",
        }));
        return;
      }
      setPublishState((current) => ({ ...current, activeIndex: step, failIndex: null, simulated: true }));
    }, 760);
  };

  const simulateFail = () => {
    clearPublishTimer();
    setPublishState((current) => ({
      ...current,
      open: true,
      activeIndex: 2,
      failIndex: 2,
      simulated: true,
      toast: "这里模拟失败提示；当前不会影响线上旧版本。",
    }));
  };

  const closePublish = () => {
    clearPublishTimer();
    setPublishState((current) => ({ ...current, open: false }));
  };

  const saveArticleDraft = async ({ title, body, toastTitle, toastMessage }) => {
    setSaveBusy(true);
    clearPublishTimer();
    try {
      await createOwnerDraft({
        kind: "article",
        title,
        body,
        coverUrl: articleImageURL.trim(),
        status: "draft",
      });
      setPublishState({
        open: true,
        title: toastTitle,
        activeIndex: -1,
        failIndex: null,
        simulated: false,
        toast: toastMessage,
      });
      await loadConsole();
    } catch (e) {
      setError(e.message || "草稿保存失败");
    } finally {
      setSaveBusy(false);
    }
  };

  const handleSaveDraft = async () => {
    await saveArticleDraft({
      title: articleTitle,
      body: articleBody,
      toastTitle: "草稿已保存",
      toastMessage: "桌面端 Markdown 草稿已保存到真实后端，后续可以继续编辑。",
    });
  };

  const handlePublishArticle = async ({
    draftId,
    title,
    body,
    coverUrl = "",
    publishTitle = "Publish article",
  }) => {
    setPublishBusy(true);
    clearPublishTimer();
    setError("");
    setPublishState({
      open: true,
      title: publishTitle,
      activeIndex: 3,
      failIndex: null,
      simulated: false,
      toast: "Submitting the article to the real publish pipeline...",
    });

    try {
      const data = await publishOwnerArticle({
        ...(draftId ? { draftId } : {}),
        title,
        body,
        coverUrl,
      });
      const item = data.item || {};
      const commitSha = item.commitSha ? ` (commit ${item.commitSha.slice(0, 7)})` : "";
      setPublishState({
        open: true,
        title: publishTitle,
        activeIndex: publishSteps.length,
        failIndex: null,
        simulated: false,
        toast: item.path
          ? `Published to ${item.path}${commitSha}. GitHub Actions will deploy from ${item.branch || "master"}.`
          : "Article publish submitted successfully.",
      });
      await loadConsole();
    } catch (e) {
      const message = e.message || "Article publish failed";
      setError(message);
      setPublishState({
        open: true,
        title: publishTitle,
        activeIndex: 3,
        failIndex: 3,
        simulated: false,
        toast: message,
      });
    } finally {
      setPublishBusy(false);
    }
  };

  const generateMobileArticle = () => {
    const draft = buildMobileArticleDraft(mobileMaterial);
    setMobileDraft(draft);
    setMobileToast("AI 已生成待审核草稿，确认后会保存到真实草稿箱。");
  };

  const approveMobileArticle = async () => {
    const nextDraft =
      mobileDraft.title === "待生成文章" ? buildMobileArticleDraft(mobileMaterial) : mobileDraft;
    if (nextDraft !== mobileDraft) setMobileDraft(nextDraft);
    await saveArticleDraft({
      title: nextDraft.title,
      body: nextDraft.body,
      toastTitle: "移动端 AI 草稿已保存",
      toastMessage: "移动端 AI 文章已经保存为真实草稿，当前阶段不会直接发布到网站。",
    });
    setMobileToast("AI 草稿已保存到真实草稿箱，可以在草稿页继续处理。");
  };

  const handleGalleryUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    setError("");
    try {
      const resolvedAlbum = resolveOwnerGalleryAlbum(galleryAlbum, customGalleryAlbum);
      if (!resolvedAlbum) {
        throw new Error("Please choose an album or enter a custom album name.");
      }
      const data = await uploadOwnerAsset(file, { kind: "gallery", album: resolvedAlbum });
      const item = data.item || {};
      setGalleryUploads((current) => [
        {
          name: item.path || item.name || file.name,
          url: item.url || "",
        },
        ...current,
      ]);
      setPublishState({
        open: true,
        title: "图片已上传",
        activeIndex: -1,
        failIndex: null,
        toast: `图片已上传到真实后端：${item.url || file.name}`,
      });
      await loadConsole();
    } catch (e) {
      setError(e.message || "图片上传失败");
    } finally {
      event.target.value = "";
      setUploadBusy(false);
    }
  };

  const handleAddGalleryURL = () => {
    const next = galleryURLInput.trim();
    if (!isPublicImageURL(next)) {
      setError("Please enter a valid public image URL.");
      return;
    }
    setError("");
    setGalleryUploads((current) => [{ name: "PicGo URL", url: next }, ...current]);
    setGalleryURLInput("");
    setPublishState({
      open: true,
      title: "Gallery link added",
      activeIndex: -1,
      failIndex: null,
      simulated: false,
      toast: `Gallery image will use ${next}`,
    });
  };

  const handleArticleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setArticleUploadBusy(true);
    setError("");
    try {
      const data = await uploadOwnerAsset(file, { kind: "article" });
      const item = data.item || {};
      const nextURL = item.url || "";
      setArticleImageURL(nextURL);
      setPublishState({
        open: true,
        title: "Article cover uploaded",
        activeIndex: -1,
        failIndex: null,
        simulated: false,
        toast: nextURL || file.name,
      });
    } catch (e) {
      setError(e.message || "Article image upload failed");
    } finally {
      event.target.value = "";
      setArticleUploadBusy(false);
    }
  };

  const testAiQuestion = () => {
    const question = aiQuestion.trim() || "用户问题";
    setCandidateAnswers([
      `关于“${question}”，目前建议先在控制台内调试回答，固定问答库还在后续阶段。`,
      "这块功能先保留原型交互，等真实内容链路稳定后再接固定回答入库。",
      "第一阶段重点是真实上传和真实草稿，AI 固定答案区先继续本地演示。",
    ]);
    setSelectedAnswerIndex(0);
    setAnswerToast("已生成 3 条候选答案。");
  };

  const saveFixedAnswer = () => {
    const question = aiQuestion.trim() || "未命名问题";
    const answer = manualAnswer.trim() || candidateAnswers[selectedAnswerIndex] || "";
    if (!answer) {
      setAnswerToast("请先选一条候选答案，或手动填写最终答案。");
      return;
    }
    setFixedAnswers((current) => [{ question, answer }, ...current]);
    setManualAnswer("");
    setAnswerToast("已保存到当前原型会话。");
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

  const visibleDrafts = liveDrafts.length
    ? liveDrafts
    : [
        {
          id: "seed-1",
          title: articleTitle,
          kind: "article",
          body: articleBody,
          updatedAt: "local prototype",
          status: "draft",
        },
      ];

  return (
    <main className="owner-console">
      <div className="owner-console-app">
        <aside className="owner-console-sidebar owner-glass" aria-label="Owner console sections">
          <button
            type="button"
            className="owner-brand"
            onClick={() => openScreen("home")}
            aria-label="Open owner console"
          >
            <span className="owner-brand-mark">TC</span>
            <span>
              <strong>Taozhiyy Control</strong>
              <small>Owner workspace</small>
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
                Latest deployment: waiting for publish stage
              </span>
              <div className="owner-notify-wrap">
                <button
                  type="button"
                  className="owner-icon-button"
                  onClick={() => {
                    setNotificationsOpen((open) => !open);
                    setAvatarOpen(false);
                  }}
                  aria-label="Notifications"
                >
                  <FiBell aria-hidden />
                  <span className="owner-badge">{notificationTotal}</span>
                </button>
                {notificationsOpen ? (
                  <div className="owner-popover owner-glass">
                    <div className="owner-panel-title">
                      <h2>Notifications</h2>
                      <StatusTag>{notificationTotal}</StatusTag>
                    </div>
                    <div className="owner-notice-list">
                      {liveNotifications.map((item) => (
                        <button
                          type="button"
                          key={`${item.source}-${item.title}`}
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
                  aria-label="Switch avatar"
                >
                  <span className="owner-avatar-face" style={{ background: avatar.gradient }}>
                    {avatar.initial}
                  </span>
                </button>
                {avatarOpen ? (
                  <div className="owner-avatar-switcher owner-glass">
                    <div className="owner-panel-title">
                      <h2>Avatar Preview</h2>
                      <StatusTag>local</StatusTag>
                    </div>
                    <div className="owner-avatar-grid">
                      {ownerConsoleAvatars.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          className={`owner-avatar-option ${item.id === avatar.id ? "active" : ""}`}
                          onClick={() => {
                            setAvatar(item);
                            setAvatarOpen(false);
                          }}
                        >
                          <span className="owner-avatar-face" style={{ background: item.gradient }}>
                            {item.initial}
                          </span>
                          <span>{item.label}</span>
                        </button>
                      ))}
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
                    <h2>Quick Modules</h2>
                    <p>First phase focuses on real data, uploads, and drafts.</p>
                  </div>
                  <StatusTag>Phase 1</StatusTag>
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
                    <h2>Users And Traffic</h2>
                    <StatusTag>{ownerStatus ? "live" : "fallback"}</StatusTag>
                  </div>
                  <div className="owner-stats-grid">
                    <article className="owner-stat-card">
                      <span>Registered users</span>
                      <strong>{ownerStatus?.users?.total ?? liveUsers.length ?? 0}</strong>
                      <em>real data</em>
                    </article>
                    <article className="owner-stat-card">
                      <span>Owner session</span>
                      <strong>{ownerLabel}</strong>
                      <em>{healthLabel}</em>
                    </article>
                    <article className="owner-stat-card">
                      <span>Message reminders</span>
                      <strong>{notificationTotal}</strong>
                      <em>guestbook + friends</em>
                    </article>
                    <article className="owner-stat-card">
                      <span>AI today</span>
                      <strong>{statsSnapshot.today}</strong>
                      <em>{statsSnapshot.model}</em>
                    </article>
                  </div>
                </section>

                <section className="owner-panel owner-glass">
                  <div className="owner-panel-title">
                    <h2>Latest Users</h2>
                    <button type="button" className="owner-secondary owner-small-button">
                      live list
                    </button>
                  </div>
                  <div className="owner-user-list">
                    <div className="owner-user-row">
                      <span className="owner-user-avatar">{userInitial(ownerLabel)}</span>
                      <span>
                        <strong>{ownerLabel}</strong>
                        <small>Owner session · {healthLabel}</small>
                      </span>
                      <StatusTag>Owner</StatusTag>
                    </div>
                    {liveUsers.map((user) => (
                      <div className="owner-user-row" key={`${user.email}-${user.createdAt}`}>
                        <span className="owner-user-avatar">{userInitial(user.displayName)}</span>
                        <span>
                          <strong>{user.displayName}</strong>
                          <small>{user.email}</small>
                        </span>
                        <StatusTag>{user.isOwner ? "Owner" : "User"}</StatusTag>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <aside className="owner-side-stack">
                <section className="owner-panel owner-glass">
                  <div className="owner-panel-title">
                    <h2>Notifications</h2>
                    <StatusTag>{notificationTotal}</StatusTag>
                  </div>
                  <div className="owner-notice-list">
                    {liveNotifications.map((item) => (
                      <button
                        type="button"
                        key={`${item.source}-${item.title}-panel`}
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
                    <h2>Publish Tasks</h2>
                    <StatusTag>phase 1</StatusTag>
                  </div>
                  <div className="owner-task-list">
                    <div className="owner-task-row">
                      <span>Current drafts</span>
                      <strong>{draftCount}</strong>
                    </div>
                    <div className="owner-task-row">
                      <span>Uploaded images</span>
                      <strong>{galleryUploads.length}</strong>
                    </div>
                    <div className="owner-task-row">
                      <span>Deployment</span>
                      <strong>later stage</strong>
                    </div>
                  </div>
                  <button type="button" className="owner-secondary" onClick={handleSync}>
                    <FiRefreshCw aria-hidden /> Refresh backend status
                  </button>
                </section>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "article" ? "active" : ""}`}>
            <div className="owner-form-shell owner-glass owner-desktop-article">
              <div>
                <div className="owner-field">
                  <label htmlFor="articleType">Article type</label>
                  <select id="articleType">
                    <option>Blog</option>
                    <option>Build Notes</option>
                  </select>
                </div>
                <div className="owner-field">
                  <label htmlFor="articleTitle">Title</label>
                  <input
                    id="articleTitle"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                  />
                </div>
                <p className="owner-frontmatter-hint">
                  This phase saves real Markdown drafts to the backend, and article publish now
                  submits through the real owner API.
                </p>
                <div className="owner-field">
                  <label htmlFor="articleCoverUrl">Cover image URL</label>
                  <input
                    id="articleCoverUrl"
                    value={articleImageURL}
                    placeholder="https://cdn.example/article-cover.png"
                    onChange={(e) => setArticleImageURL(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <label className="owner-secondary" htmlFor="articleImageUpload">
                    <FiUpload aria-hidden /> {articleUploadBusy ? "Uploading..." : "Upload cover to COS"}
                  </label>
                  <input
                    id="articleImageUpload"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={handleArticleImageUpload}
                    hidden
                  />
                  <span className="owner-pill">
                    {articleImageURL
                      ? "Cover ready for publish"
                      : "Paste a PicGo URL or upload a cover image"}
                  </span>
                </div>
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
                  <button
                    type="button"
                    className="owner-secondary"
                    onClick={handleSaveDraft}
                    disabled={saveBusy}
                  >
                    {saveBusy ? "Saving..." : "Save draft"}
                  </button>
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={() =>
                      handlePublishArticle({
                        title: articleTitle,
                        body: articleBody,
                        coverUrl: articleImageURL.trim(),
                        publishTitle: "Publish article",
                      })
                    }
                    disabled={publishBusy}
                  >
                    {publishBusy ? "Publishing..." : "Publish article"}
                  </button>
                </div>
              </div>
              <aside className="owner-md-preview">
                <div className="owner-kicker">Markdown Preview</div>
                <div className="owner-cover">{articleImageURL ? "cover linked" : "cover preview"}</div>
                <h2>{articleTitle || "Untitled article"}</h2>
                <pre>{previewBody}</pre>
                <p>
                  {articleImageURL
                    ? `Cover URL: ${articleImageURL}`
                    : "Add a public cover URL or upload one to COS."}
                </p>
              </aside>
            </div>

            <div className="owner-mobile-article">
              <section className="owner-agent-card owner-glass">
                <div className="owner-panel-title">
                  <h2>Mobile AI Draft</h2>
                  <StatusTag>shared draft API</StatusTag>
                </div>
                <div className="owner-agent-steps">
                  <div>
                    <b>1. Add material</b>
                    <span>Write rough points or mobile notes.</span>
                  </div>
                  <div>
                    <b>2. Generate AI draft</b>
                    <span>Keep the current prototype generation flow.</span>
                  </div>
                  <div>
                    <b>3. Save real draft</b>
                    <span>Approval now stores into the same backend draft box.</span>
                  </div>
                </div>
                <div className="owner-agent-dropzone">
                  <strong>Phase 1 note</strong>
                  <span>Mobile content is real at the draft layer, not real at publish layer yet.</span>
                </div>
                <div className="owner-field">
                  <label htmlFor="mobileArticleInput">Material for AI</label>
                  <textarea
                    id="mobileArticleInput"
                    value={mobileMaterial}
                    onChange={(e) => setMobileMaterial(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary" onClick={generateMobileArticle}>
                    Generate AI draft
                  </button>
                  <button type="button" className="owner-primary" onClick={approveMobileArticle}>
                    Save approved draft
                  </button>
                </div>
                <p className="owner-agent-toast">{mobileToast}</p>
              </section>
              <aside className="owner-agent-preview owner-glass">
                <div className="owner-kicker">AI Draft Preview</div>
                <div className="owner-cover">material cover</div>
                <h2>{mobileDraft.title}</h2>
                <pre>{mobileDraft.body}</pre>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "drafts" ? "active" : ""}`}>
            <div className="owner-panel owner-glass">
              <div className="owner-panel-title">
                <h2>Draft Box</h2>
                <button
                  type="button"
                  className="owner-primary owner-small-button"
                  onClick={() => openScreen("article")}
                >
                  New article
                </button>
              </div>
              <div className="owner-mini-metrics">
                <div>
                  <span>Article drafts</span>
                  <b>{draftCount}</b>
                </div>
                <div>
                  <span>Uploaded images</span>
                  <b>{galleryUploads.length}</b>
                </div>
                <div>
                  <span>Needs cover</span>
                  <b>{visibleDrafts.filter((item) => !item.coverUrl).length}</b>
                </div>
                <div>
                  <span>Ready later</span>
                  <b>{visibleDrafts.length}</b>
                </div>
              </div>
              <div className="owner-draft-list">
                {visibleDrafts.map((item, index) => (
                  <article className="owner-draft-item" key={item.id || `${item.title}-${index}`}>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{draftDetail(item)}</small>
                    </span>
                    <span className="owner-quick-line">
                      <button
                        type="button"
                        className="owner-secondary"
                        onClick={() => {
                          setArticleTitle(item.title || "");
                          setArticleBody(item.body || "");
                          setArticleImageURL(item.coverUrl || "");
                          openScreen("article");
                        }}
                      >
                        Continue
                      </button>
                      <button
                        type="button"
                        className="owner-primary"
                        onClick={() =>
                          handlePublishArticle({
                            draftId: item.id,
                            title: item.title || articleTitle,
                            body: item.body || articleBody,
                            coverUrl: item.coverUrl || "",
                            publishTitle: "Draft publish flow",
                          })
                        }
                        disabled={publishBusy}
                      >
                        {publishBusy ? "Publishing..." : "Publish now"}
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
                  <label htmlFor="galleryAlbum">Album</label>
                  <select
                    id="galleryAlbum"
                    value={galleryAlbum}
                    onChange={(e) => setGalleryAlbum(e.target.value)}
                  >
                    {ownerGalleryAlbumOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                {galleryAlbum === ownerCustomGalleryAlbumValue ? (
                  <div className="owner-field owner-field--spaced">
                    <label htmlFor="customGalleryAlbum">Custom album</label>
                    <input
                      id="customGalleryAlbum"
                      value={customGalleryAlbum}
                      placeholder="请输入自定义相册名"
                      onChange={(e) => setCustomGalleryAlbum(e.target.value)}
                    />
                  </div>
                ) : null}
                <label className="owner-dropzone" htmlFor="galleryUpload">
                  <strong>Choose an image to upload</strong>
                  <span>
                    Upload the image to COS, or paste a public PicGo image URL below.
                  </span>
                </label>
                <input
                  id="galleryUpload"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleGalleryUpload}
                  hidden
                />
                <div className="owner-field owner-field--spaced">
                  <label htmlFor="galleryURLInput">Public image URL</label>
                  <input
                    id="galleryURLInput"
                    value={galleryURLInput}
                    placeholder="https://cdn.example/gallery/demo.png"
                    onChange={(e) => setGalleryURLInput(e.target.value)}
                  />
                </div>
                <div className="owner-thumb-grid">
                  {(galleryUploads.length ? galleryUploads : [{ name: "No uploads yet" }]).map((item) => (
                    <span key={item.url || item.name}>{item.name}</span>
                  ))}
                </div>
                <div className="owner-quick-line">
                  <label
                    className={`owner-secondary ${uploadBusy ? "owner-secondary--disabled" : ""}`}
                    htmlFor="galleryUpload"
                    aria-disabled={uploadBusy}
                  >
                    <FiUpload aria-hidden /> {uploadBusy ? "Uploading..." : "Upload to COS"}
                  </label>
                  <button type="button" className="owner-secondary" onClick={handleAddGalleryURL}>
                    Add PicGo URL
                  </button>
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={() => startPublish("Gallery publish flow")}
                  >
                    Open publish flow
                  </button>
                </div>
              </div>
              <aside className="owner-preview-card">
                <div className="owner-kicker">Upload Preview</div>
                <div className="owner-cover">album cover</div>
                <h2>{galleryUploads[0]?.name || "No uploaded image yet"}</h2>
                <p>
                  {galleryUploads[0]?.url
                    ? `Real upload URL: ${galleryUploads[0].url}`
                    : "Upload an image to COS or add a public image URL."}
                </p>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "friend" ? "active" : ""}`}>
            <div className="owner-form-shell owner-glass">
              <div>
                <div className="owner-field">
                  <label htmlFor="friendName">Site name</label>
                  <input
                    id="friendName"
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                  />
                </div>
                <div className="owner-field">
                  <label htmlFor="friendUrl">Site URL</label>
                  <input id="friendUrl" defaultValue="https://hub.131714.xyz/" />
                </div>
                <div className="owner-field">
                  <label htmlFor="friendDesc">Description</label>
                  <textarea
                    id="friendDesc"
                    value={friendDesc}
                    onChange={(e) => setFriendDesc(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary">
                    Validate later
                  </button>
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={() => startPublish("Friend link flow")}
                  >
                    Prototype only
                  </button>
                </div>
              </div>
              <aside className="owner-preview-card">
                <div className="owner-kicker">Friend Card</div>
                <div className="owner-friend-preview">
                  <span>{userInitial(friendName)}</span>
                  <div>
                    <h2>{friendName || "Site name"}</h2>
                    <p>{friendDesc || "Site description"}</p>
                  </div>
                </div>
                <p>This area stays as a prototype in phase 1.</p>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "inbox" ? "active" : ""}`}>
            <div className="owner-panel owner-glass">
              <div className="owner-panel-title">
                <h2>Unified Inbox</h2>
                <StatusTag>{notificationTotal} reminders</StatusTag>
              </div>
              <div className="owner-inbox-list">
                {liveNotifications.map((item) => (
                  <article className="owner-message" key={`${item.source}-${item.title}-inbox`}>
                    <div className="owner-message-head">
                      <strong>{item.title}</strong>
                      <StatusTag>{item.source}</StatusTag>
                    </div>
                    <p>{item.detail}</p>
                    <div className="owner-quick-line">
                      <button type="button" className="owner-secondary">
                        Reply later
                      </button>
                      <button type="button" className="owner-secondary">
                        Mark read later
                      </button>
                      {item.source === "friends" ? (
                        <button
                          type="button"
                          className="owner-primary"
                          onClick={() => openScreen("friend")}
                        >
                          Open friend flow
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
                <h2>AI Usage</h2>
                <StatusTag>today</StatusTag>
              </div>
              <div className="owner-mini-metrics">
                <div>
                  <span>Today</span>
                  <b>{statsSnapshot.today}</b>
                </div>
                <div>
                  <span>Period</span>
                  <b>{statsSnapshot.period}</b>
                </div>
                <div>
                  <span>Success rate</span>
                  <b>{statsSnapshot.successRate}</b>
                </div>
                <div>
                  <span>Configured</span>
                  <b>{statsSnapshot.configured ? "yes" : "no"}</b>
                </div>
              </div>
            </div>

            <div className="owner-ai-workbench">
              <section className="owner-debug-box owner-glass">
                <div className="owner-panel-title">
                  <h2>AI Debug Prototype</h2>
                  <StatusTag>local only</StatusTag>
                </div>
                <div className="owner-field">
                  <label htmlFor="aiQuestion">Test question</label>
                  <textarea
                    id="aiQuestion"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary" onClick={testAiQuestion}>
                    Generate candidates
                  </button>
                  <button type="button" className="owner-primary" onClick={saveFixedAnswer}>
                    Save local answer
                  </button>
                </div>
                <div className="owner-panel-title owner-panel-title--spaced">
                  <h2>Candidates</h2>
                  <StatusTag>pick one</StatusTag>
                </div>
                <div className="owner-candidate-list">
                  {candidateAnswers.map((answer, index) => (
                    <button
                      type="button"
                      key={answer}
                      className={selectedAnswerIndex === index ? "selected" : ""}
                      onClick={() => {
                        setSelectedAnswerIndex(index);
                        setAnswerToast("Selected one candidate answer.");
                      }}
                    >
                      {answer}
                    </button>
                  ))}
                </div>
                <div className="owner-field owner-field--spaced">
                  <label htmlFor="manualAnswer">Manual final answer</label>
                  <textarea
                    id="manualAnswer"
                    placeholder="Rewrite or complete the final answer here."
                    value={manualAnswer}
                    onChange={(e) => setManualAnswer(e.target.value)}
                  />
                </div>
                <p className="owner-answer-toast">{answerToast}</p>
              </section>

              <aside className="owner-debug-box owner-glass">
                <div className="owner-panel-title">
                  <h2>Saved Answers</h2>
                  <StatusTag>prototype</StatusTag>
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
              {screen.navLabel}
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
            <button type="button" className="owner-close" onClick={closePublish} aria-label="Close">
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
                        ? publishState.simulated
                          ? "Simulated failure"
                          : "Failed"
                        : active
                          ? "Running"
                          : done
                            ? "Completed"
                            : "Waiting"}
                    </small>
                  </span>
                  <em>{failed ? "fail" : done ? "done" : active ? "active" : "idle"}</em>
                </div>
              );
            })}
          </div>
          <p className="owner-toast">{publishState.toast}</p>
          {publishState.simulated ? (
            <div className="owner-quick-line">
              <button type="button" className="owner-secondary" onClick={simulateFail}>
                Simulate fail
              </button>
              <button
                type="button"
                className="owner-primary"
                onClick={() => startPublish(publishState.title || "Retry publish flow")}
              >
                Retry simulation
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
};

export default AppConsolePage;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiBell, FiRefreshCw, FiUpload, FiX } from "react-icons/fi";
import { authMe } from "../services/authApi";
import { fetchChatStats } from "../services/chatStatsApi";
import {
  createOwnerDraft,
  fetchOwnerStatus,
  isPublicImageURL,
  markOwnerNotificationRead,
  publishOwnerArticle,
  publishOwnerFriend,
  publishOwnerGalleryImage,
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
  getOwnerRegisteredUsers,
  getStatsSnapshot,
} from "../pwa/appConsoleState";
import {
  getOwnerGalleryAlbumSelection,
  ownerCustomGalleryAlbumValue,
  ownerGalleryAlbumOptions,
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

const defaultFriendLink = {
  name: "桃之夭夭",
  desc: "桃之夭夭的小屋",
  url: "https://taozhiyy.top",
};

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
  const kindLabel = kind === "article" ? "文章" : kind;
  return `${kindLabel} · ${updatedAt || "刚刚"} · ${bodyBytes} 字节`;
};

const userInitial = (name) => (name || "?").slice(0, 1).toUpperCase();

const notificationSourceLabel = (source) => {
  switch (source) {
    case "guestbook":
      return "留言板";
    case "friends":
      return "朋友页";
    default:
      return source || "提醒";
  }
};

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
  const [friendName, setFriendName] = useState(defaultFriendLink.name);
  const [friendDesc, setFriendDesc] = useState(defaultFriendLink.desc);
  const [friendUrl, setFriendUrl] = useState(defaultFriendLink.url);
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
  const [galleryPublishBusy, setGalleryPublishBusy] = useState(false);
  const [friendPublishBusy, setFriendPublishBusy] = useState(false);
  const [readingNotificationId, setReadingNotificationId] = useState(null);
  const [publishState, setPublishState] = useState({
    open: false,
    title: "发布任务",
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
  const registeredUsers = getOwnerRegisteredUsers(ownerStatus);
  const liveDrafts = ownerStatus?.drafts?.items || [];
  const draftCount = ownerStatus?.drafts?.total ?? liveDrafts.length;
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
      simulated: true,
      toast: "这里展示发布流程预览；真实写入能力已经接到草稿、图片和文章/相册发布接口。",
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
          toast: "流程预览完成。真实发布请使用文章或相册里的发布按钮。",
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
      toast: "这里是失败状态预览，不会影响线上内容。",
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
    publishTitle = "发布文章",
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
      toast: "正在提交到真实文章发布接口...",
    });

    try {
      const data = await publishOwnerArticle({
        ...(draftId ? { draftId } : {}),
        title,
        body,
        coverUrl,
      });
      const item = data.item || {};
      const commitSha = item.commitSha ? `（commit ${item.commitSha.slice(0, 7)}）` : "";
      setPublishState({
        open: true,
        title: publishTitle,
        activeIndex: publishSteps.length,
        failIndex: null,
        simulated: false,
        toast: item.path
          ? `已发布到 ${item.path}${commitSha}，GitHub Actions 会从 ${item.branch || "master"} 部署。`
          : "文章发布已提交。",
      });
      await loadConsole();
    } catch (e) {
      const message = e.message || "文章发布失败";
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
      const albumSelection = getOwnerGalleryAlbumSelection(galleryAlbum, customGalleryAlbum);
      const uploadAlbum = albumSelection.albumId || albumSelection.albumTitle;
      if (!uploadAlbum) {
        throw new Error("请选择相册，或填写自定义相册名。");
      }
      const data = await uploadOwnerAsset(file, { kind: "gallery", album: uploadAlbum });
      const item = data.item || {};
      setGalleryUploads((current) => [
        {
          name: item.path || item.name || file.name,
          url: item.url || "",
          albumId: albumSelection.albumId,
          albumTitle: albumSelection.albumTitle,
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
      setError("请输入有效的公开图片 URL。");
      return;
    }
    const albumSelection = getOwnerGalleryAlbumSelection(galleryAlbum, customGalleryAlbum);
    if (!albumSelection.albumId && !albumSelection.albumTitle) {
      setError("请选择相册，或填写自定义相册名。");
      return;
    }
    setError("");
    setGalleryUploads((current) => [
      {
        name: "PicGo 图片 URL",
        url: next,
        albumId: albumSelection.albumId,
        albumTitle: albumSelection.albumTitle,
      },
      ...current,
    ]);
    setGalleryURLInput("");
    setPublishState({
      open: true,
      title: "相册图片链接已加入",
      activeIndex: -1,
      failIndex: null,
      simulated: false,
      toast: `相册发布将使用 ${next}`,
    });
  };

  const handlePublishGalleryImage = async () => {
    const latest = galleryUploads[0];
    if (!latest?.url) {
      setError("请先上传图片，或添加一个公开图片 URL。");
      return;
    }
    if (!latest.albumId && !latest.albumTitle) {
      setError("请选择相册，或填写自定义相册名。");
      return;
    }

    setGalleryPublishBusy(true);
    clearPublishTimer();
    setError("");
    setPublishState({
      open: true,
      title: "发布相册图片",
      activeIndex: 3,
      failIndex: null,
      simulated: false,
      toast: "正在提交到真实相册发布接口...",
    });

    try {
      const data = await publishOwnerGalleryImage({
        albumId: latest.albumId || "",
        albumTitle: latest.albumTitle || "",
        imageUrl: latest.url,
      });
      const item = data.item || {};
      const commitSha = item.commitSha ? `（commit ${item.commitSha.slice(0, 7)}）` : "";
      setGalleryUploads((current) =>
        current.map((entry, index) =>
          index === 0
            ? {
                ...entry,
                albumId: item.albumId || entry.albumId,
                published: true,
              }
            : entry,
        ),
      );
      setPublishState({
        open: true,
        title: "发布相册图片",
        activeIndex: publishSteps.length,
        failIndex: null,
        simulated: false,
        toast: item.changed === false
          ? `这张图片已经在 ${item.path || "相册数据"} 中。`
          : `已发布到 ${item.path || "相册数据"}${commitSha}，GitHub Actions 会从 ${item.branch || "master"} 部署。`,
      });
      await loadConsole();
    } catch (e) {
      const message = e.message || "相册发布失败";
      setError(message);
      setPublishState({
        open: true,
        title: "发布相册图片",
        activeIndex: 3,
        failIndex: 3,
        simulated: false,
        toast: message,
      });
    } finally {
      setGalleryPublishBusy(false);
    }
  };

  const handlePublishFriend = async () => {
    const name = friendName.trim();
    const desc = friendDesc.trim();
    const url = friendUrl.trim();
    if (!name || !desc || !url) {
      setError("请填写站点名称、站点描述和站点 URL。");
      return;
    }
    if (!isPublicImageURL(url)) {
      setError("友链 URL 必须是公开的 http 或 https 地址。");
      return;
    }

    setFriendPublishBusy(true);
    clearPublishTimer();
    setError("");
    setPublishState({
      open: true,
      title: "发布友链",
      activeIndex: 3,
      failIndex: null,
      simulated: false,
      toast: "正在提交到真实友链发布接口...",
    });

    try {
      const data = await publishOwnerFriend({ name, desc, url });
      const item = data.item || {};
      const commitSha = item.commitSha ? `（commit ${item.commitSha.slice(0, 7)}）` : "";
      setPublishState({
        open: true,
        title: "发布友链",
        activeIndex: publishSteps.length,
        failIndex: null,
        simulated: false,
        toast: item.changed === false
          ? `这条友链已经存在于 ${item.path || "友链数据"}。`
          : `已写入 ${item.path || "友链数据"}${commitSha}，GitHub Actions 会从 ${item.branch || "master"} 部署。`,
      });
      await loadConsole();
    } catch (e) {
      const message = e.message || "友链发布失败";
      setError(message);
      setPublishState({
        open: true,
        title: "发布友链",
        activeIndex: 3,
        failIndex: 3,
        simulated: false,
        toast: message,
      });
    } finally {
      setFriendPublishBusy(false);
    }
  };

  const handleMarkNotificationRead = async (item) => {
    if (!item?.id) {
      setError("这条提醒没有可标记的留言 ID，请刷新后再试。");
      return;
    }
    setReadingNotificationId(item.id);
    setError("");
    try {
      await markOwnerNotificationRead(item.id);
      await loadConsole();
      setPublishState({
        open: true,
        title: "提醒已读",
        activeIndex: -1,
        failIndex: null,
        simulated: false,
        toast: "已从站长收件箱移除这条未读提醒，公开留言内容不会被隐藏。",
      });
    } catch (e) {
      setError(e.message || "标记已读失败");
    } finally {
      setReadingNotificationId(null);
    }
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
        title: "文章封面已上传",
        activeIndex: -1,
        failIndex: null,
        simulated: false,
        toast: nextURL || file.name,
      });
    } catch (e) {
      setError(e.message || "文章图片上传失败");
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
          updatedAt: "本地预览",
          status: "draft",
        },
      ];

  return (
    <main className="owner-console">
      <div className="owner-console-app">
        <aside className="owner-console-sidebar owner-glass" aria-label="站长控制器分区">
          <button
            type="button"
            className="owner-brand"
            onClick={() => openScreen("home")}
            aria-label="打开站长控制器"
          >
            <span className="owner-brand-mark">TC</span>
            <span>
              <strong>桃之夭夭控制器</strong>
              <small>站长工作区</small>
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
                最新部署：等待发布阶段
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
                  aria-label="切换头像"
                >
                  <span className="owner-avatar-face" style={{ background: avatar.gradient }}>
                    {avatar.initial}
                  </span>
                </button>
                {avatarOpen ? (
                  <div className="owner-avatar-switcher owner-glass">
                    <div className="owner-panel-title">
                      <h2>头像预览</h2>
                      <StatusTag>本地</StatusTag>
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
                    <h2>快捷模块</h2>
                    <p>第一阶段重点接通真实数据、上传和草稿。</p>
                  </div>
                  <StatusTag>第一阶段</StatusTag>
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
                    <h2>用户与流量</h2>
                    <StatusTag>{ownerStatus ? "实时" : "备用"}</StatusTag>
                  </div>
                  <div className="owner-stats-grid">
                    <article className="owner-stat-card">
                      <span>注册用户</span>
                      <strong>{ownerStatus?.users?.total ?? liveUsers.length ?? 0}</strong>
                      <em>真实数据</em>
                    </article>
                    <article className="owner-stat-card">
                      <span>站长会话</span>
                      <strong>{ownerLabel}</strong>
                      <em>{healthLabel}</em>
                    </article>
                    <article className="owner-stat-card">
                      <span>消息提醒</span>
                      <strong>{notificationTotal}</strong>
                      <em>guestbook + friends</em>
                    </article>
                    <article className="owner-stat-card">
                      <span>今日 AI</span>
                      <strong>{statsSnapshot.today}</strong>
                      <em>{statsSnapshot.model}</em>
                    </article>
                  </div>
                </section>

                <section className="owner-panel owner-glass">
                  <div className="owner-panel-title">
                    <h2>最新用户</h2>
                    <button type="button" className="owner-secondary owner-small-button">
                      实时列表
                    </button>
                  </div>
                  <div className="owner-user-list">
                    <div className="owner-user-row">
                      <span className="owner-user-avatar">{userInitial(ownerLabel)}</span>
                      <span>
                        <strong>{ownerLabel}</strong>
                        <small>站长会话 · {healthLabel}</small>
                      </span>
                      <StatusTag>站长</StatusTag>
                    </div>
                    {liveUsers.map((user) => (
                      <div className="owner-user-row" key={`${user.email}-${user.createdAt}`}>
                        <span className="owner-user-avatar">{userInitial(user.displayName)}</span>
                        <span>
                          <strong>{user.displayName}</strong>
                          <small>{user.email}</small>
                        </span>
                        <StatusTag>{user.isOwner ? "站长" : "用户"}</StatusTag>
                      </div>
                    ))}
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
                    <h2>发布任务</h2>
                    <StatusTag>第一阶段</StatusTag>
                  </div>
                  <div className="owner-task-list">
                    <div className="owner-task-row">
                      <span>当前草稿</span>
                      <strong>{draftCount}</strong>
                    </div>
                    <div className="owner-task-row">
                      <span>已上传图片</span>
                      <strong>{galleryUploads.length}</strong>
                    </div>
                    <div className="owner-task-row">
                      <span>部署</span>
                      <strong>后续阶段</strong>
                    </div>
                  </div>
                  <button type="button" className="owner-secondary" onClick={handleSync}>
                    <FiRefreshCw aria-hidden /> 刷新后端状态
                  </button>
                </section>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "article" ? "active" : ""}`}>
            <div className="owner-form-shell owner-glass owner-desktop-article">
              <div>
                <div className="owner-field">
                  <label htmlFor="articleType">文章类型</label>
                  <select id="articleType">
                    <option>博客</option>
                    <option>建站记录</option>
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
                  当前阶段会把 Markdown 草稿保存到真实后端，文章发布也会提交到真实站长接口。
                </p>
                <div className="owner-field">
                  <label htmlFor="articleCoverUrl">封面图片 URL</label>
                  <input
                    id="articleCoverUrl"
                    value={articleImageURL}
                    placeholder="https://cdn.example/article-cover.png"
                    onChange={(e) => setArticleImageURL(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <label className="owner-secondary" htmlFor="articleImageUpload">
                    <FiUpload aria-hidden /> {articleUploadBusy ? "上传中..." : "上传封面到 COS"}
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
                      ? "封面已准备好发布"
                      : "粘贴 PicGo URL，或上传一张封面图"}
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
                    {saveBusy ? "保存中..." : "保存草稿"}
                  </button>
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={() =>
                      handlePublishArticle({
                        title: articleTitle,
                        body: articleBody,
                        coverUrl: articleImageURL.trim(),
                        publishTitle: "发布文章",
                      })
                    }
                    disabled={publishBusy}
                  >
                    {publishBusy ? "发布中..." : "发布文章"}
                  </button>
                </div>
              </div>
              <aside className="owner-md-preview">
                <div className="owner-kicker">Markdown 预览</div>
                <div className="owner-cover">{articleImageURL ? "封面已链接" : "封面预览"}</div>
                <h2>{articleTitle || "未命名文章"}</h2>
                <pre>{previewBody}</pre>
                <p>
                  {articleImageURL
                    ? `封面 URL：${articleImageURL}`
                    : "添加公开封面 URL，或上传一张封面到 COS。"}
                </p>
              </aside>
            </div>

            <div className="owner-mobile-article">
              <section className="owner-agent-card owner-glass">
                <div className="owner-panel-title">
                  <h2>移动端 AI 草稿</h2>
                  <StatusTag>共用草稿接口</StatusTag>
                </div>
                <div className="owner-agent-steps">
                  <div>
                    <b>1. 添加素材</b>
                    <span>写下要点或手机端随手记录。</span>
                  </div>
                  <div>
                    <b>2. 生成 AI 草稿</b>
                    <span>先保留当前草稿生成流程。</span>
                  </div>
                  <div>
                    <b>3. 保存真实草稿</b>
                    <span>确认后会写入同一个后端草稿箱。</span>
                  </div>
                </div>
                <div className="owner-agent-dropzone">
                  <strong>第一阶段说明</strong>
                  <span>移动端内容已经接到真实草稿层，发布层请从草稿箱继续处理。</span>
                </div>
                <div className="owner-field">
                  <label htmlFor="mobileArticleInput">AI 素材</label>
                  <textarea
                    id="mobileArticleInput"
                    value={mobileMaterial}
                    onChange={(e) => setMobileMaterial(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary" onClick={generateMobileArticle}>
                    生成 AI 草稿
                  </button>
                  <button type="button" className="owner-primary" onClick={approveMobileArticle}>
                    保存确认后的草稿
                  </button>
                </div>
                <p className="owner-agent-toast">{mobileToast}</p>
              </section>
              <aside className="owner-agent-preview owner-glass">
                <div className="owner-kicker">AI 草稿预览</div>
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
                  <b>{draftCount}</b>
                </div>
                <div>
                  <span>已上传图片</span>
                  <b>{galleryUploads.length}</b>
                </div>
                <div>
                  <span>缺少封面</span>
                  <b>{visibleDrafts.filter((item) => !item.coverUrl).length}</b>
                </div>
                <div>
                  <span>待处理</span>
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
                        继续编辑
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
                            publishTitle: "草稿发布流程",
                          })
                        }
                        disabled={publishBusy}
                      >
                        {publishBusy ? "发布中..." : "立即发布"}
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
                  <label htmlFor="galleryAlbum">相册</label>
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
                    <label htmlFor="customGalleryAlbum">自定义相册</label>
                    <input
                      id="customGalleryAlbum"
                      value={customGalleryAlbum}
                      placeholder="请输入自定义相册名"
                      onChange={(e) => setCustomGalleryAlbum(e.target.value)}
                    />
                  </div>
                ) : null}
                <label className="owner-dropzone" htmlFor="galleryUpload">
                  <strong>选择要上传的图片</strong>
                  <span>
                    上传图片到 COS，或在下方粘贴公开 PicGo 图片 URL。
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
                  <label htmlFor="galleryURLInput">公开图片 URL</label>
                  <input
                    id="galleryURLInput"
                    value={galleryURLInput}
                    placeholder="https://cdn.example/gallery/demo.png"
                    onChange={(e) => setGalleryURLInput(e.target.value)}
                  />
                </div>
                <div className="owner-thumb-grid">
                  {(galleryUploads.length ? galleryUploads : [{ name: "暂无上传" }]).map((item) => (
                    <span key={item.url || item.name}>
                      {item.name}
                      {item.albumTitle ? ` -> ${item.albumTitle}` : ""}
                    </span>
                  ))}
                </div>
                <div className="owner-quick-line">
                  <label
                    className={`owner-secondary ${uploadBusy ? "owner-secondary--disabled" : ""}`}
                    htmlFor="galleryUpload"
                    aria-disabled={uploadBusy}
                  >
                    <FiUpload aria-hidden /> {uploadBusy ? "上传中..." : "上传到 COS"}
                  </label>
                  <button type="button" className="owner-secondary" onClick={handleAddGalleryURL}>
                    添加 PicGo URL
                  </button>
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={handlePublishGalleryImage}
                    disabled={!galleryUploads[0]?.url || galleryPublishBusy}
                  >
                    {galleryPublishBusy ? "发布中..." : "发布到相册"}
                  </button>
                </div>
              </div>
              <aside className="owner-preview-card">
                <div className="owner-kicker">上传预览</div>
                <div className="owner-cover">相册封面</div>
                <h2>{galleryUploads[0]?.name || "暂无已上传图片"}</h2>
                <p>
                  {galleryUploads[0]?.url
                    ? `真实上传 URL：${galleryUploads[0].url}。目标相册：${
                        galleryUploads[0].albumTitle || galleryUploads[0].albumId || "相册"
                      }。`
                    : "上传图片到 COS，或添加一个公开图片 URL。"}
                </p>
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
                  <label htmlFor="friendUrl">站点 URL</label>
                  <input
                    id="friendUrl"
                    value={friendUrl}
                    onChange={(e) => setFriendUrl(e.target.value)}
                  />
                </div>
                <div className="owner-field">
                  <label htmlFor="friendDesc">站点描述</label>
                  <textarea
                    id="friendDesc"
                    value={friendDesc}
                    onChange={(e) => setFriendDesc(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button
                    type="button"
                    className="owner-secondary"
                    onClick={() => {
                      if (!isPublicImageURL(friendUrl.trim())) {
                        setError("友链 URL 必须是公开的 http 或 https 地址。");
                        return;
                      }
                      setError("");
                      setPublishState({
                        open: true,
                        title: "友链校验通过",
                        activeIndex: -1,
                        failIndex: null,
                        simulated: false,
                        toast: "站点 URL 格式有效，可以提交到真实友链数据。",
                      });
                    }}
                  >
                    校验链接
                  </button>
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={handlePublishFriend}
                    disabled={friendPublishBusy}
                  >
                    {friendPublishBusy ? "发布中..." : "发布友链"}
                  </button>
                </div>
              </div>
              <aside className="owner-preview-card">
                <div className="owner-kicker">友链卡片</div>
                <div className="owner-friend-preview">
                  <span>{userInitial(friendName)}</span>
                  <div>
                    <h2>{friendName || "站点名称"}</h2>
                    <p>{friendDesc || "站点描述"}</p>
                  </div>
                </div>
                <p>{friendUrl || "https://taozhiyy.top"}</p>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "inbox" ? "active" : ""}`}>
            <div className="owner-panel owner-glass">
              <div className="owner-panel-title">
                <h2>统一收件箱</h2>
                <StatusTag>{notificationTotal} 条提醒</StatusTag>
              </div>
              <div className="owner-inbox-list">
                {liveNotifications.map((item) => (
                  <article className="owner-message" key={item.id || `${item.source}-${item.title}-inbox`}>
                    <div className="owner-message-head">
                      <strong>{item.title}</strong>
                      <StatusTag>{notificationSourceLabel(item.source)}</StatusTag>
                    </div>
                    <p>{item.detail}</p>
                    {item.content ? (
                      <blockquote className="owner-message-content">{item.content}</blockquote>
                    ) : null}
                    {item.nickname || item.createdAt ? (
                      <small className="owner-message-meta">
                        {item.nickname || "访客"} · {item.createdAt || "时间未知"}
                      </small>
                    ) : null}
                    <div className="owner-quick-line">
                      <button type="button" className="owner-secondary">
                        稍后回复
                      </button>
                      <button
                        type="button"
                        className="owner-secondary"
                        onClick={() => handleMarkNotificationRead(item)}
                        disabled={readingNotificationId === item.id}
                      >
                        {readingNotificationId === item.id ? "处理中..." : "标记已读"}
                      </button>
                      {item.source === "friends" ? (
                        <button
                          type="button"
                          className="owner-primary"
                          onClick={() => openScreen("friend")}
                        >
                          打开友链流程
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
                <h2>AI 使用情况</h2>
                <StatusTag>今天</StatusTag>
              </div>
              <div className="owner-mini-metrics">
                <div>
                  <span>今天</span>
                  <b>{statsSnapshot.today}</b>
                </div>
                <div>
                  <span>周期</span>
                  <b>{statsSnapshot.period}</b>
                </div>
                <div>
                  <span>成功率</span>
                  <b>{statsSnapshot.successRate}</b>
                </div>
                <div>
                  <span>已配置</span>
                  <b>{statsSnapshot.configured ? "是" : "否"}</b>
                </div>
              </div>
            </div>

            <div className="owner-ai-workbench">
              <section className="owner-debug-box owner-glass">
                <div className="owner-panel-title">
                  <h2>AI 调试区</h2>
                  <StatusTag>本地会话</StatusTag>
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
                    生成候选答案
                  </button>
                  <button type="button" className="owner-primary" onClick={saveFixedAnswer}>
                    保存本地答案
                  </button>
                </div>
                <div className="owner-panel-title owner-panel-title--spaced">
                  <h2>候选答案</h2>
                  <StatusTag>选择一条</StatusTag>
                </div>
                <div className="owner-candidate-list">
                  {candidateAnswers.map((answer, index) => (
                    <button
                      type="button"
                      key={answer}
                      className={selectedAnswerIndex === index ? "selected" : ""}
                      onClick={() => {
                        setSelectedAnswerIndex(index);
                        setAnswerToast("已选择一条候选答案。");
                      }}
                    >
                      {answer}
                    </button>
                  ))}
                </div>
                <div className="owner-field owner-field--spaced">
                  <label htmlFor="manualAnswer">手动最终答案</label>
                  <textarea
                    id="manualAnswer"
                    placeholder="在这里改写或补全最终答案。"
                    value={manualAnswer}
                    onChange={(e) => setManualAnswer(e.target.value)}
                  />
                </div>
                <p className="owner-answer-toast">{answerToast}</p>
              </section>

              <aside className="owner-debug-box owner-glass">
                <div className="owner-panel-title">
                  <h2>AI 注册用户</h2>
                  <StatusTag>{registeredUsers.length}</StatusTag>
                </div>
                <div className="owner-user-list">
                  {registeredUsers.length ? (
                    registeredUsers.map((user) => (
                      <article className="owner-user-row" key={`${user.email}-${user.createdAt}`}>
                        <span className="owner-user-avatar">{userInitial(user.displayName || user.email)}</span>
                        <span>
                          <strong>{user.displayName || "未设置昵称"}</strong>
                          <small>{user.email}</small>
                          <small>注册时间：{user.createdAt || "未知"}</small>
                        </span>
                        <StatusTag>用户</StatusTag>
                      </article>
                    ))
                  ) : (
                    <article className="owner-empty-row">暂无注册用户</article>
                  )}
                </div>
                <div className="owner-panel-title owner-panel-title--spaced">
                  <h2>已保存答案</h2>
                  <StatusTag>本地原型</StatusTag>
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

      <nav className="owner-bottom-nav" aria-label="移动端站长控制器分区">
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
              <div className="owner-kicker">发布流程</div>
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
                        ? publishState.simulated
                          ? "预览失败"
                          : "失败"
                        : active
                          ? "运行中"
                          : done
                            ? "已完成"
                            : "等待中"}
                    </small>
                  </span>
                  <em>{failed ? "失败" : done ? "完成" : active ? "进行中" : "等待"}</em>
                </div>
              );
            })}
          </div>
          <p className="owner-toast">{publishState.toast}</p>
          {publishState.simulated ? (
            <div className="owner-quick-line">
              <button type="button" className="owner-secondary" onClick={simulateFail}>
                预览失败
              </button>
              <button
                type="button"
                className="owner-primary"
                onClick={() => startPublish(publishState.title || "重试发布流程")}
              >
                重试预览
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
};

export default AppConsolePage;

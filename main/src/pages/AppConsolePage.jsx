import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiBell, FiRefreshCw, FiUpload, FiX } from "react-icons/fi";
import {
  createOwnerDraft,
  fetchOwnerEmails,
  fetchOwnerStatus,
  isPublicImageURL,
  markOwnerNotificationRead,
  publishOwnerArticle,
  publishOwnerFriend,
  publishOwnerGalleryImage,
  publishOwnerMoment,
  uploadOwnerAsset,
} from "../services/ownerApi";
import { parseFriendQuickInput } from "../lib/friendQuickInput";
import { SITE_ORIGIN } from "../lib/siteIdentity.js";
import { ownerFriendPublishToast } from "../lib/ownerPublishMessages";
import {
  buildMobileArticleDraft,
  getNotificationTotal,
  ownerConsoleAvatars,
  ownerConsoleModules,
  ownerConsoleNotifications,
  ownerConsoleScreens,
  publishSteps,
} from "../pwa/appConsoleBlueprint";
import { lockOwnerGate } from "../services/ownerGateApi";
import {
  getBackendHealthLabel,
  getOwnerGuestbookContacts,
  getOwnerSessionLabel,
} from "../pwa/appConsoleState";
import {
  areUsableDimensions,
  isGalleryImageSource,
  measureImageFile,
  measureImageSource,
} from "../lib/galleryImageSource";
import { cosAsset } from "../lib/cosAsset.js";

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
- 真实留言提醒
`;

const defaultMobileMaterial =
  "今天把手机端 AI 发文流程接到真实草稿接口，图片和文字都能先保存到站长控制台。";

const defaultFriendLink = {
  name: "伊洛华",
  desc: "伊洛华的小屋",
  url: SITE_ORIGIN,
  avatar: `${SITE_ORIGIN}${cosAsset("1.png")}`,
};

const defaultMoment = {
  year: "2026",
  date: "6.8",
  type: "碎碎念",
  content: "今天也想把小碎片写下来",
};

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
  const [health, setHealth] = useState(null);
  const [ownerStatus, setOwnerStatus] = useState(null);
  const [ownerEmails, setOwnerEmails] = useState(null);
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
  const [friendAvatar, setFriendAvatar] = useState(defaultFriendLink.avatar);
  const [friendQuickInput, setFriendQuickInput] = useState("");
  const [momentYear, setMomentYear] = useState(defaultMoment.year);
  const [momentDate, setMomentDate] = useState(defaultMoment.date);
  const [momentType, setMomentType] = useState(defaultMoment.type);
  const [momentContent, setMomentContent] = useState(defaultMoment.content);
  const [mobileMaterial, setMobileMaterial] = useState(defaultMobileMaterial);
  const [mobileDraft, setMobileDraft] = useState({
    title: "待生成文章",
    body: "点击“让 AI 写草稿”后，这里会出现移动端文章草稿。",
  });
  const [mobileToast, setMobileToast] = useState(
    "把图片和文字交给 AI 后，第一阶段会先保存为真实草稿，不直接发线上。",
  );
  const [galleryURLInput, setGalleryURLInput] = useState("");
  const [galleryTitleInput, setGalleryTitleInput] = useState("");
  const [galleryUploads, setGalleryUploads] = useState([]);
  const [saveBusy, setSaveBusy] = useState(false);
  const [publishBusy, setPublishBusy] = useState(false);
  const [articleUploadBusy, setArticleUploadBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [galleryPublishBusy, setGalleryPublishBusy] = useState(false);
  const [friendPublishBusy, setFriendPublishBusy] = useState(false);
  const [momentPublishBusy, setMomentPublishBusy] = useState(false);
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
    const [healthResult, ownerStatusResult, ownerEmailsResult] =
      await Promise.allSettled([
        fetchBackendHealth(),
        fetchOwnerStatus(),
        fetchOwnerEmails(),
      ]);

    if (healthResult.status === "fulfilled") setHealth(healthResult.value);
    if (ownerStatusResult.status === "fulfilled") setOwnerStatus(ownerStatusResult.value);
    if (ownerEmailsResult.status === "fulfilled") setOwnerEmails(ownerEmailsResult.value);

    const requiredFailures = [healthResult].some(
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

  const lockConsole = useCallback(async () => {
    await lockOwnerGate().catch(() => {});
    window.location.reload();
  }, []);

  const activeMeta = screenMap[activeScreen] || screenMap.home;
  const ownerLabel = getOwnerSessionLabel(ownerStatus);
  const healthLabel = getBackendHealthLabel(health);
  const liveNotifications = ownerStatus?.notifications?.items || ownerConsoleNotifications;
  const notificationTotal =
    ownerStatus?.notifications?.total ?? getNotificationTotal(ownerConsoleNotifications);
  const guestbookContacts = getOwnerGuestbookContacts(ownerEmails);
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
      // 相册按原始像素尺寸排版，所以上传前先在浏览器里把宽高量出来。
      const size = await measureImageFile(file);
      if (!areUsableDimensions(size.width, size.height)) {
        throw new Error("读不出这张图片的像素尺寸，换一张试试。");
      }
      const data = await uploadOwnerAsset(file, { kind: "gallery" });
      const item = data.item || {};
      setGalleryUploads((current) => [
        {
          name: item.path || item.name || file.name,
          url: item.url || "",
          thumbUrl: item.thumbUrl || "",
          width: size.width,
          height: size.height,
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

  const handleAddGalleryURL = async () => {
    const next = galleryURLInput.trim();
    if (!isGalleryImageSource(next)) {
      setError("请输入站内 /cos/ 开头的路径，或一个公开的图片 URL。");
      return;
    }
    setError("");
    setUploadBusy(true);
    try {
      const size = await measureImageSource(next);
      if (!areUsableDimensions(size.width, size.height)) {
        throw new Error("读不出这张图片的像素尺寸，换一个地址试试。");
      }
      setGalleryUploads((current) => [
        {
          name: next.startsWith("/cos/") ? "站内图片" : "公开图片 URL",
          url: next,
          width: size.width,
          height: size.height,
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
        toast: `相册发布将使用 ${next}（${size.width} × ${size.height}）`,
      });
    } catch (e) {
      setError(e.message || "无法读取这张图片。");
    } finally {
      setUploadBusy(false);
    }
  };

  const handlePublishGalleryImage = async () => {
    const latest = galleryUploads[0];
    if (!latest?.url) {
      setError("请先上传图片，或添加一个公开图片 URL。");
      return;
    }
    if (!areUsableDimensions(latest.width, latest.height)) {
      setError("这张图片缺少像素尺寸，请重新上传或重新添加地址。");
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
        imageUrl: latest.url,
        thumbUrl: latest.thumbUrl || "",
        width: latest.width,
        height: latest.height,
        title: galleryTitleInput.trim(),
      });
      const item = data.item || {};
      const commitSha = item.commitSha ? `（commit ${item.commitSha.slice(0, 7)}）` : "";
      setGalleryUploads((current) =>
        current.map((entry, index) =>
          index === 0 ? { ...entry, photoId: item.photoId || "", published: true } : entry,
        ),
      );
      setGalleryTitleInput("");
      setPublishState({
        open: true,
        title: "发布相册图片",
        activeIndex: publishSteps.length,
        failIndex: null,
        simulated: false,
        toast: item.changed === false
          ? `这张图片已经在 ${item.path || "相册数据"} 中。`
          : `已发布到 ${item.path || "相册数据"}${commitSha}，排在相册最前面，GitHub Actions 会从 ${item.branch || "master"} 部署。`,
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

  const handlePublishMoment = async () => {
    const year = momentYear.trim();
    const date = momentDate.trim();
    const type = momentType.trim();
    const content = momentContent.trim();
    if (!year || !type || !content) {
      setError("请填写碎语年份、分类和内容。");
      return;
    }

    setMomentPublishBusy(true);
    clearPublishTimer();
    setError("");
    setPublishState({
      open: true,
      title: "发布碎语",
      activeIndex: 3,
      failIndex: null,
      simulated: false,
      toast: "正在提交到真实碎语发布接口...",
    });

    try {
      const data = await publishOwnerMoment({ year, date, type, content });
      const item = data.item || {};
      const commitSha = item.commitSha ? `（commit ${item.commitSha.slice(0, 7)}）` : "";
      setPublishState({
        open: true,
        title: "发布碎语",
        activeIndex: publishSteps.length,
        failIndex: null,
        simulated: false,
        toast: `已写入 ${item.path || "碎语数据"}${commitSha}，GitHub Actions 会从 ${item.branch || "master"} 部署。`,
      });
      await loadConsole();
    } catch (e) {
      const message = e.message || "碎语发布失败";
      setError(message);
      setPublishState({
        open: true,
        title: "发布碎语",
        activeIndex: 3,
        failIndex: 3,
        simulated: false,
        toast: message,
      });
    } finally {
      setMomentPublishBusy(false);
    }
  };

  const handleFriendQuickFill = () => {
    const parsed = parseFriendQuickInput(friendQuickInput);
    if (!parsed.name || !parsed.desc || !parsed.url) {
      setError("没有识别完整，请确认四行里包含站名、描述和站点 URL。");
      return;
    }
    setFriendName(parsed.name);
    setFriendDesc(parsed.desc);
    setFriendUrl(parsed.url);
    setFriendAvatar(parsed.avatar);
    setError("");
    setPublishState({
      open: true,
      title: "友链 AI 识别",
      activeIndex: -1,
      failIndex: null,
      simulated: false,
      toast: "已自动识别站名、描述、站点 URL 和头像 URL，并填入友链表单。",
    });
  };

  const handlePublishFriend = async () => {
    const name = friendName.trim();
    const desc = friendDesc.trim();
    const url = friendUrl.trim();
    const avatarUrl = friendAvatar.trim();
    if (!name || !desc || !url) {
      setError("请填写站点名称、站点描述和站点 URL。");
      return;
    }
    if (!isPublicImageURL(url)) {
      setError("友链 URL 必须是公开的 http 或 https 地址。");
      return;
    }
    if (avatarUrl && !isPublicImageURL(avatarUrl)) {
      setError("友链头像 URL 必须是公开的 http 或 https 地址。");
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
      const data = await publishOwnerFriend({ name, desc, url, avatar: avatarUrl });
      const item = data.item || {};
      setPublishState({
        open: true,
        title: "发布友链",
        activeIndex: publishSteps.length,
        failIndex: null,
        simulated: false,
        toast: ownerFriendPublishToast(item),
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
              <strong>伊洛华控制器</strong>
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
          <button type="button" className="owner-lock-button" onClick={lockConsole}>
            锁上控制台
          </button>
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
                      <span>留言联系人</span>
                      <strong>{guestbookContacts.length}</strong>
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
                  <label htmlFor="galleryTitleInput">说明（可选）</label>
                  <input
                    id="galleryTitleInput"
                    value={galleryTitleInput}
                    placeholder="一句话说明，留空就只显示照片"
                    onChange={(e) => setGalleryTitleInput(e.target.value)}
                  />
                </div>
                <label className="owner-dropzone owner-field--spaced" htmlFor="galleryUpload">
                  <strong>选择要上传的图片</strong>
                  <span>
                    上传图片到 COS，或在下方填站内 /cos/ 路径、公开图片 URL。
                    发布后这张会排在相册最前面。
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
                  <label htmlFor="galleryURLInput">图片地址</label>
                  <input
                    id="galleryURLInput"
                    value={galleryURLInput}
                    placeholder="/cos/gallery/2026/08/demo.jpg 或 https://cdn.example/demo.png"
                    onChange={(e) => setGalleryURLInput(e.target.value)}
                  />
                </div>
                <div className="owner-thumb-grid">
                  {(galleryUploads.length ? galleryUploads : [{ name: "暂无上传" }]).map((item) => (
                    <span key={item.url || item.name}>
                      {item.name}
                      {item.width && item.height ? ` · ${item.width} × ${item.height}` : ""}
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
                  <button
                    type="button"
                    className="owner-secondary"
                    onClick={handleAddGalleryURL}
                    disabled={uploadBusy}
                  >
                    添加图片地址
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
                <div className="owner-cover">下一张发布</div>
                <h2>{galleryUploads[0]?.name || "暂无已上传图片"}</h2>
                <p>
                  {galleryUploads[0]?.url
                    ? `地址：${galleryUploads[0].url}。原始尺寸：${
                        galleryUploads[0].width || "?"
                      } × ${galleryUploads[0].height || "?"}。发布后排在相册最前面。`
                    : "上传图片到 COS，或填一个站内 /cos/ 路径、公开图片 URL。"}
                </p>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "moments" ? "active" : ""}`}>
            <div className="owner-form-shell owner-glass">
              <div>
                <div className="owner-field">
                  <label htmlFor="momentYear">年份</label>
                  <input
                    id="momentYear"
                    value={momentYear}
                    placeholder="2026"
                    onChange={(e) => setMomentYear(e.target.value)}
                  />
                </div>
                <div className="owner-field">
                  <label htmlFor="momentDate">日期</label>
                  <input
                    id="momentDate"
                    value={momentDate}
                    placeholder="6.8"
                    onChange={(e) => setMomentDate(e.target.value)}
                  />
                </div>
                <div className="owner-field">
                  <label htmlFor="momentType">分类</label>
                  <input
                    id="momentType"
                    value={momentType}
                    placeholder="碎碎念"
                    onChange={(e) => setMomentType(e.target.value)}
                  />
                </div>
                <div className="owner-field">
                  <label htmlFor="momentContent">内容</label>
                  <textarea
                    id="momentContent"
                    value={momentContent}
                    placeholder="写下今天的一点点心情"
                    onChange={(e) => setMomentContent(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button
                    type="button"
                    className="owner-primary"
                    onClick={handlePublishMoment}
                    disabled={momentPublishBusy}
                  >
                    {momentPublishBusy ? "发布中..." : "发布碎语"}
                  </button>
                </div>
              </div>
              <aside className="owner-preview-card">
                <div className="owner-kicker">碎语预览</div>
                <div className="owner-friend-preview">
                  <span>{momentYear || "2026"} · {momentDate || "6.8"}</span>
                  <div>
                    <h2>{momentType || "分类"}</h2>
                    <p>{momentContent || "碎语内容"}</p>
                  </div>
                </div>
                <p>发布后会写入首页右上角导航进入的“碎语”页面。</p>
              </aside>
            </div>
          </section>

          <section className={`owner-screen ${activeScreen === "friend" ? "active" : ""}`}>
            <div className="owner-form-shell owner-glass">
              <div>
                <div className="owner-field">
                  <label htmlFor="friendQuickInput">AI 识别四行友链</label>
                  <textarea
                    id="friendQuickInput"
                    value={friendQuickInput}
                    placeholder={"把站名、描述、站点 URL、头像 URL 四行一起粘进来，顺序可以乱。"}
                    onChange={(e) => setFriendQuickInput(e.target.value)}
                  />
                </div>
                <div className="owner-quick-line">
                  <button type="button" className="owner-secondary" onClick={handleFriendQuickFill}>
                    AI 识别填表
                  </button>
                </div>
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
                  <label htmlFor="friendAvatar">头像 URL</label>
                  <input
                    id="friendAvatar"
                    value={friendAvatar}
                    onChange={(e) => setFriendAvatar(e.target.value)}
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
                      if (friendAvatar.trim() && !isPublicImageURL(friendAvatar.trim())) {
                        setError("友链头像 URL 必须是公开的 http 或 https 地址。");
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
                  {isPublicImageURL(friendAvatar.trim()) ? (
                    <img src={friendAvatar.trim()} alt={friendName || "站点头像"} />
                  ) : (
                    <span>{userInitial(friendName)}</span>
                  )}
                  <div>
                    <h2>{friendName || "站点名称"}</h2>
                    <p>{friendDesc || "站点描述"}</p>
                  </div>
                </div>
                <p>{friendUrl || SITE_ORIGIN}</p>
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

          <section className={`owner-screen ${activeScreen === "emails" ? "active" : ""}`}>
            <div className="owner-content-grid">
              <section className="owner-panel owner-glass">
                <div className="owner-panel-title">
                  <h2>留言联系邮箱</h2>
                  <StatusTag>{guestbookContacts.length}</StatusTag>
                </div>
                <div className="owner-user-list">
                  {guestbookContacts.length ? (
                    guestbookContacts.map((contact) => (
                      <article
                        className="owner-user-row owner-user-row--stacked"
                        key={`${contact.id}-${contact.contactEmail}`}
                      >
                        <span className="owner-user-avatar">{userInitial(contact.nickname || contact.contactEmail)}</span>
                        <span>
                          <strong>{contact.nickname || "访客"}</strong>
                          <small>{contact.contactEmail}</small>
                          {contact.content ? <small>{contact.content}</small> : null}
                        </span>
                        <StatusTag>{notificationSourceLabel(contact.source)}</StatusTag>
                      </article>
                    ))
                  ) : (
                    <article className="owner-empty-row">暂无留言联系邮箱</article>
                  )}
                </div>
              </section>
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

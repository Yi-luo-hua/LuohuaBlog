import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { asList } from "../lib/asList";
import { authMe } from "../services/authApi";
import {
  fetchGuestbookMessages,
  postGuestbookMessage,
  postGuestbookReply,
} from "../services/guestbookMessagesApi";
import { normalizeFriendsThreads } from "./friendsApplicationThreads";

const FRIEND_TEMPLATE = `站点名称：
站点链接：
站点描述：
头像链接：
已添加本站友链：是`;

const cardTone = (item) => {
  if (item.isAdminUser) return "admin";
  if (item.isLoginUser) return "login";
  return "guest";
};

const nameFromUser = (user) => {
  const displayName = user?.displayName?.trim();
  if (displayName) return displayName;
  return user?.email ? user.email.split("@")[0].slice(0, 12) : "";
};

const roleLabel = (item) => {
  if (item.isAdminUser) return "站长";
  if (item.isLoginUser) return "已登录";
  return "访客";
};

const formatTime = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
};

const FriendsApplicationBoard = () => {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState(FRIEND_TEMPLATE);
  const [submitting, setSubmitting] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyTargetId, setReplyTargetId] = useState(null);
  const [expandedThreads, setExpandedThreads] = useState({});
  const [replySubmittingId, setReplySubmittingId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    authMe().then(({ data }) => {
      if (data?.loggedIn && data.user) {
        setUser(data.user);
      }
    });
  }, []);

  useEffect(() => {
    const onProfileUpdated = (event) => {
      if (event.detail?.user) setUser(event.detail.user);
    };
    window.addEventListener("blog-auth-profile-updated", onProfileUpdated);
    return () => {
      window.removeEventListener("blog-auth-profile-updated", onProfileUpdated);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadEntries = async () => {
      setLoading(true);
      const { ok, data } = await fetchGuestbookMessages(1, 30);
      if (cancelled) return;
      if (!ok) {
        setEntries([]);
        setLoading(false);
        return;
      }
      const nextEntries = normalizeFriendsThreads(asList(data));
      setEntries(nextEntries);
      setExpandedThreads(
        Object.fromEntries(nextEntries.map((item) => [item.id, (item.replyCount || 0) > 0]))
      );
      setLoading(false);
    };

    loadEntries();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      setError("请先登录后再提交友链申请。");
      return;
    }
    if (!content.trim()) return;

    setSubmitting(true);
    setNotice("");
    setError("");

    const { ok, data } = await postGuestbookMessage({
      content: content.trim(),
    });

    setSubmitting(false);

    if (!ok) {
      if (data.error === "RATE_LIMITED") {
        setError(data.message || "提交太频繁啦，稍后再来试试。");
      } else if (data.message) {
        setError(data.message);
      } else {
        setError("友链申请没有提交成功，请稍后再试。");
      }
      return;
    }

    setContent(FRIEND_TEMPLATE);
    setNotice("友链申请已经提交成功。");
    if (data.item) {
      setEntries((prev) => [{ ...data.item, replies: [], replyCount: 0 }, ...prev].slice(0, 30));
    }
  };

  const onReplySubmit = async (parentId) => {
    if (!user) {
      setError("请先登录后再回复这条友链申请。");
      return;
    }

    const nextContent = (replyDrafts[parentId] || "").trim();
    if (!nextContent) return;

    setReplySubmittingId(parentId);
    setNotice("");
    setError("");

    const { ok, data } = await postGuestbookReply(parentId, nextContent);

    setReplySubmittingId(null);

    if (!ok) {
      setError(data.message || "回复没有提交成功，请稍后再试。");
      return;
    }

    setEntries((prev) =>
      prev.map((item) =>
        item.id === parentId
          ? {
              ...item,
              replies: [...(item.replies || []), data.item],
              replyCount: (item.replyCount || 0) + 1,
            }
          : item
      )
    );
    setExpandedThreads((prev) => ({ ...prev, [parentId]: true }));
    setReplyDrafts((prev) => ({ ...prev, [parentId]: "" }));
    setReplyTargetId(null);
    setNotice("回复已经贴在这条申请下面啦。");
  };

  const displayName = nameFromUser(user);

  return (
    <section id="friends-guestbook" className="relative">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#74C0FC]">
            Comment Style
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#2B2B2B]">
            留言申请
          </h2>
        </div>
        <p className="max-w-xl text-sm leading-7 text-[#6B7280]">
          这一部分沿用留言板接口，但提交友链申请时必须先登录。留言展示做成自由评论风格，也支持在申请下面继续回复。
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          onSubmit={onSubmit}
          className="rounded-[24px] border border-[#F2E6C9] bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(255,249,243,0.95))] p-5 shadow-[0_16px_40px_rgba(95,75,82,0.10)] md:p-6"
        >
          {user ? (
            <p className="mb-4 text-sm font-semibold text-[#74C0FC]">
              以 {displayName} 身份提交友链申请
            </p>
          ) : (
            <div className="mb-5 rounded-[16px] border border-dashed border-[#F2E6C9] bg-[#FFFDF8] px-4 py-4">
              <p className="text-sm leading-7 text-[#6B7280]">
                这里的友链申请需要登录后才能提交。
              </p>
              <Link
                to="/login"
                className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full border-2 border-[#74C0FC] bg-white px-5 py-2.5 text-sm font-bold text-[#2B2B2B] shadow-[0_8px_24px_rgba(116,192,252,0.16)] transition hover:border-[#FF8FAB]"
              >
                去登录 / 注册
              </Link>
            </div>
          )}

          <label className="mb-1 block text-xs font-semibold text-[#6B7280]">
            申请内容
          </label>
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            maxLength={500}
            rows={8}
            required
            disabled={!user || submitting}
            className="w-full resize-y rounded-2xl border border-[#F2E6C9] bg-[#FFFBF5] px-4 py-3 text-base leading-relaxed text-[#2B2B2B] outline-none transition focus:border-[#FFD43B] disabled:cursor-not-allowed disabled:opacity-70"
          />

          <button
            type="submit"
            disabled={!user || submitting}
            className="mt-4 min-h-[44px] w-full rounded-full border-2 border-[#FFD43B] bg-gradient-to-r from-[#FFFDF5] to-[#FFF8E7] px-6 py-3 text-sm font-bold text-[#2B2B2B] shadow-[0_8px_24px_rgba(255,212,59,0.25)] transition hover:border-[#FF8FAB] hover:shadow-[0_10px_28px_rgba(255,143,171,0.2)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "提交中..." : "提交友链申请"}
          </button>

          {notice && <p className="mt-3 text-sm font-semibold text-[#51CF66]">{notice}</p>}
          {error && <p className="mt-3 text-sm text-[#E67700]">{error}</p>}
        </form>

        <div className="space-y-4">
          {loading && <p className="text-sm text-[#6B7280]">加载申请留言中...</p>}

          {!loading && entries.length === 0 && (
            <div className="rounded-[18px] border border-dashed border-[#F2E6C9] bg-white/80 px-4 py-10 text-center text-sm text-[#6B7280]">
              还没有友链申请留言，欢迎留下第一条。
            </div>
          )}

          {entries.map((item) => {
            const tone = cardTone(item);
            const isExpanded = !!expandedThreads[item.id];
            const isReplying = replyTargetId === item.id;
            const replies = item.replies || [];

            return (
              <article
                key={item.id}
                className={clsx(
                  "relative rounded-[22px] border p-5 shadow-[0_12px_30px_rgba(95,75,82,0.08)]",
                  tone === "guest" && "border-[#FFE066]/60 bg-[#FFF9DB]",
                  tone === "login" && "border-[#A5D8FF]/60 bg-[#F7FBFF]",
                  tone === "admin" && "border-[#FFC9C9]/70 bg-[#FFF0F6]"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-base font-bold text-[#2B2B2B]">
                      {item.nickname}
                      <span className="ml-2 text-xs font-normal text-[#6B7280]">
                        {roleLabel(item)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {item.ipRegion || "未知地区"} 路 {formatTime(item.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.replyCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedThreads((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                        }
                        className="rounded-full border border-[#E7D8C7] bg-white/70 px-3 py-1 text-xs font-semibold text-[#7B5C61] transition hover:border-[#FF8FAB]"
                      >
                        {isExpanded ? "收起回复" : `展开回复（${item.replyCount}）`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setReplyTargetId((current) => (current === item.id ? null : item.id))}
                      className="rounded-full border border-[#E7D8C7] bg-white/80 px-3 py-1 text-xs font-semibold text-[#7B5C61] transition hover:border-[#74C0FC]"
                    >
                      回复
                    </button>
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-8 text-[#2B2B2B]">
                  {item.content}
                </p>

                {isReplying && (
                  <div className="mt-4 rounded-[18px] border border-[#F2E6C9] bg-white/70 p-4">
                    {!user ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-[#6B7280]">回复前也需要先登录哦。</p>
                        <Link
                          to="/login"
                          className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[#74C0FC] bg-white px-4 py-2 text-sm font-semibold text-[#2B2B2B]"
                        >
                          去登录
                        </Link>
                      </div>
                    ) : (
                      <>
                        <label className="mb-2 block text-xs font-semibold text-[#6B7280]">
                          在这条申请下面回复
                        </label>
                        <textarea
                          value={replyDrafts[item.id] || ""}
                          onChange={(event) =>
                            setReplyDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                          }
                          maxLength={300}
                          rows={3}
                          className="w-full resize-y rounded-2xl border border-[#F2E6C9] bg-[#FFFBF5] px-4 py-3 text-sm leading-7 text-[#2B2B2B] outline-none transition focus:border-[#74C0FC]"
                        />
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => onReplySubmit(item.id)}
                            disabled={replySubmittingId === item.id}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[#74C0FC] bg-white px-4 py-2 text-sm font-semibold text-[#2B2B2B] transition hover:border-[#FF8FAB] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {replySubmittingId === item.id ? "回复中..." : "提交回复"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyTargetId(null)}
                            className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[#E7D8C7] bg-[#FFF8F1] px-4 py-2 text-sm font-semibold text-[#6B7280]"
                          >
                            取消
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {isExpanded && replies.length > 0 && (
                  <div className="mt-4 space-y-3 border-l border-[#F0E3D8] pl-4">
                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-[18px] border border-[#F3E9DF] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,248,241,0.95))] p-4 shadow-[0_8px_20px_rgba(95,75,82,0.05)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#5F4B52]">
                              {reply.nickname}
                              <span className="ml-2 text-[11px] font-normal text-[#8A7C74]">
                                {roleLabel(reply)}
                              </span>
                            </p>
                            <p className="mt-1 text-[11px] text-[#8A7C74]">
                              {reply.ipRegion || "未知地区"} 路 {formatTime(reply.createdAt)}
                            </p>
                          </div>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#5C5652]">
                          {reply.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FriendsApplicationBoard;

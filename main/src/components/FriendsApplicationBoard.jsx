import clsx from "clsx";
import { useEffect, useState } from "react";
import { FiCornerUpLeft, FiSend } from "react-icons/fi";
import { Link } from "react-router-dom";

import { asList } from "../lib/asList";
import { authMe } from "../services/authApi";
import {
  fetchGuestbookMessages,
  postGuestbookMessage,
  postGuestbookReply,
} from "../services/guestbookMessagesApi";
import { normalizeFriendsThreads } from "./friendsApplicationThreads";

const FRIEND_COMMENT_PLACEHOLDER =
  "写下你的留言、站点介绍，或者想对桃之夭夭说的话...";

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

const avatarInitial = (name = "") => {
  const trimmed = name.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : "友";
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

const CommentAvatar = ({ item, name }) => {
  const avatar = item?.avatar;
  const label = name || item?.nickname || "友链伙伴";

  return (
    <div className="shrink-0">
      {avatar ? (
        <img
          src={avatar}
          alt={label}
          className="h-12 w-12 rounded-full border-2 border-white object-cover shadow-[0_10px_24px_rgba(95,75,82,0.14)]"
        />
      ) : (
        <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-[linear-gradient(135deg,#FFE8A3,#A5D8FF)] text-sm font-black text-[#5F4B52] shadow-[0_10px_24px_rgba(95,75,82,0.14)]">
          {avatarInitial(label)}
        </div>
      )}
    </div>
  );
};

const FriendsApplicationBoard = () => {
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
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
      setError("请先登录后再留言。");
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
        setError("留言没有提交成功，请稍后再试。");
      }
      return;
    }

    setContent("");
    setNotice("留言已经提交成功。");
    if (data.item) {
      setEntries((prev) => [{ ...data.item, replies: [], replyCount: 0 }, ...prev].slice(0, 30));
    }
  };

  const onReplySubmit = async (parentId) => {
    if (!user) {
      setError("请先登录后再回复这条留言。");
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
    setNotice("回复已经贴在这条留言下面啦。");
  };

  const displayName = nameFromUser(user);

  return (
    <section id="friends-guestbook" className="relative mx-auto max-w-[920px]">
      <div className="border-b border-[#E7D8C7]/80 pb-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#74C0FC]">
              Comment Style
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#2B2B2B]">
              留言
            </h2>
          </div>
          <p className="text-sm font-semibold text-[#7B5C61]">
            {entries.length} 条留言
          </p>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6B7280]">
          像留言板一样留下一条想说的话，登录后即可提交，也可以在已有留言下面继续回复。
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-6">
        <div>
          <div className="min-w-0 flex-1 rounded-[22px] border border-[#D8E9F8] bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(241,248,255,0.72))] p-4 shadow-[0_16px_36px_rgba(95,75,82,0.08)] backdrop-blur md:p-5">
            {user ? (
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-[#4D8FC6]">
                  以 {displayName} 身份留言
                </p>
                <span className="text-xs text-[#8A7C74]">一人一条，自由留言</span>
              </div>
            ) : (
              <div className="mb-4 flex flex-col gap-3 rounded-[16px] border border-dashed border-[#D8E9F8] bg-white/65 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-[#6B7280]">
                  登录后就能在这里留言。
                </p>
                <Link
                  to="/login"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[#74C0FC] bg-white px-4 py-2 text-sm font-bold text-[#2B2B2B] shadow-[0_8px_24px_rgba(116,192,252,0.14)] transition hover:border-[#FF8FAB]"
                >
                  去登录 / 注册
                </Link>
              </div>
            )}

            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={500}
              rows={4}
              required
              disabled={!user || submitting}
              placeholder={FRIEND_COMMENT_PLACEHOLDER}
              className="min-h-[116px] w-full resize-y rounded-[18px] border border-[#CFE6F7] bg-white/58 px-4 py-3 text-base leading-relaxed text-[#2B2B2B] outline-none transition placeholder:text-[#9AA4B2] focus:border-[#74C0FC] focus:bg-white/78 disabled:cursor-not-allowed disabled:opacity-70"
            />

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-[#8A7C74]">
                {content.length}/500
              </p>
              <button
                type="submit"
                disabled={!user || submitting}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-[#74C0FC] bg-[#74C0FC] px-5 py-2.5 text-sm font-bold text-white shadow-[0_10px_24px_rgba(116,192,252,0.28)] transition hover:border-[#FF8FAB] hover:bg-[#FF8FAB] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiSend className="h-4 w-4" aria-hidden />
                {submitting ? "提交中..." : "评论"}
              </button>
            </div>

            {notice && <p className="mt-3 text-sm font-semibold text-[#2F9E44]">{notice}</p>}
            {error && <p className="mt-3 text-sm text-[#E67700]">{error}</p>}
          </div>
        </div>
      </form>

      <div className="mt-8 space-y-5">
        {loading && <p className="text-sm text-[#6B7280]">加载留言中...</p>}

        {!loading && entries.length === 0 && (
          <div className="rounded-[18px] border border-dashed border-[#D8E9F8] bg-white/70 px-4 py-10 text-center text-sm text-[#6B7280]">
            还没有留言，欢迎留下第一条。
          </div>
        )}

        {entries.map((item) => {
          const tone = cardTone(item);
          const isExpanded = !!expandedThreads[item.id];
          const isReplying = replyTargetId === item.id;
          const replies = item.replies || [];

          return (
            <article key={item.id} className="flex items-start gap-4">
              <CommentAvatar item={item} />
              <div
                className={clsx(
                  "min-w-0 flex-1 rounded-[22px] border p-4 shadow-[0_14px_32px_rgba(95,75,82,0.08)] backdrop-blur md:p-5",
                  tone === "guest" && "border-[#FFE066]/70 bg-[#FFF9DB]/72",
                  tone === "login" && "border-[#A5D8FF]/70 bg-[#F3FAFF]/78",
                  tone === "admin" && "border-[#FFC9C9]/80 bg-[#FFF0F6]/78"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#8A7C74]">
                      <span className="font-bold text-[#5F4B52]">{item.nickname}</span>
                      <span>发表于 {formatTime(item.createdAt)}</span>
                      <span className="rounded-full bg-white/62 px-2 py-0.5 text-[11px] font-semibold text-[#6B7280]">
                        {roleLabel(item)}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[#9AA4B2]">
                      {item.ipRegion || "未知地区"}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.replyCount > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedThreads((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                        }
                        className="rounded-full border border-white/70 bg-white/58 px-3 py-1 text-xs font-semibold text-[#7B5C61] transition hover:border-[#FF8FAB]"
                      >
                        {isExpanded ? "收起" : `回复 ${item.replyCount}`}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setReplyTargetId((current) => (current === item.id ? null : item.id))}
                      className="inline-flex min-h-[32px] items-center justify-center rounded-full border border-white/70 bg-white/68 px-3 py-1 text-xs font-semibold text-[#5F80C8] transition hover:border-[#74C0FC]"
                      aria-label="回复这条留言"
                    >
                      <FiCornerUpLeft className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap break-words text-[15px] font-semibold leading-8 text-[#2B2B2B]">
                  {item.content}
                </p>

                {isReplying && (
                  <div className="mt-4 rounded-[18px] border border-white/70 bg-white/54 p-4">
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
                        <textarea
                          value={replyDrafts[item.id] || ""}
                          onChange={(event) =>
                            setReplyDrafts((prev) => ({ ...prev, [item.id]: event.target.value }))
                          }
                          maxLength={300}
                          rows={3}
                          placeholder="在这条申请下面回复..."
                          className="w-full resize-y rounded-2xl border border-[#D8E9F8] bg-white/70 px-4 py-3 text-sm leading-7 text-[#2B2B2B] outline-none transition focus:border-[#74C0FC]"
                        />
                        <div className="mt-3 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => onReplySubmit(item.id)}
                            disabled={replySubmittingId === item.id}
                            className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-[#74C0FC] bg-white px-4 py-2 text-sm font-semibold text-[#2B2B2B] transition hover:border-[#FF8FAB] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {replySubmittingId === item.id ? "回复中..." : "提交回复"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyTargetId(null)}
                            className="inline-flex min-h-[38px] items-center justify-center rounded-full border border-[#E7D8C7] bg-[#FFF8F1] px-4 py-2 text-sm font-semibold text-[#6B7280]"
                          >
                            取消
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {isExpanded && replies.length > 0 && (
                  <div className="mt-4 space-y-3 border-l-4 border-white/80 pl-4">
                    {replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-3">
                        <CommentAvatar item={reply} />
                        <div className="min-w-0 flex-1 rounded-[18px] border border-white/70 bg-white/58 p-4">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#8A7C74]">
                            <span className="font-bold text-[#5F4B52]">{reply.nickname}</span>
                            <span>发表于 {formatTime(reply.createdAt)}</span>
                            <span>{roleLabel(reply)}</span>
                          </p>
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#4B5563]">
                            {reply.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default FriendsApplicationBoard;

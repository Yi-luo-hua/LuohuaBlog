import clsx from "clsx";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { asList } from "../lib/asList";
import { authMe } from "../services/authApi";
import {
  fetchGuestbookMessages,
  postGuestbookMessage,
} from "../services/guestbookMessagesApi";

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

const isFriendApplication = (item) => {
  const text = item?.content || "";
  return text.includes("站点名称") && text.includes("站点链接");
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
      const { ok, data } = await fetchGuestbookMessages(1, 20);
      if (cancelled) return;
      if (!ok) {
        setEntries([]);
        setLoading(false);
        return;
      }
      const list = asList(data).filter(isFriendApplication);
      setEntries(list);
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
    setNotice("友链申请已提交成功。");
    if (data.item && isFriendApplication(data.item)) {
      setEntries((prev) => [data.item, ...prev].slice(0, 20));
    }
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
          这一部分沿用留言板接口，但提交友链申请时必须先登录。
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <form
          onSubmit={onSubmit}
          className="rounded-[22px] border border-[#F2E6C9] bg-white p-5 shadow-[0_12px_30px_rgba(255,143,171,0.12)] md:p-6"
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
            className="w-full resize-y rounded-xl border border-[#F2E6C9] bg-[#FFFBF5] px-4 py-3 text-base leading-relaxed text-[#2B2B2B] outline-none transition focus:border-[#FFD43B] disabled:cursor-not-allowed disabled:opacity-70"
          />

          <button
            type="submit"
            disabled={!user || submitting}
            className="mt-4 min-h-[44px] w-full rounded-full border-2 border-[#FFD43B] bg-gradient-to-r from-[#FFFDF5] to-[#FFF8E7] px-6 py-3 text-sm font-bold text-[#2B2B2B] shadow-[0_8px_24px_rgba(255,212,59,0.25)] transition hover:border-[#FF8FAB] hover:shadow-[0_10px_28px_rgba(255,143,171,0.2)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {submitting ? "提交中…" : "提交友链申请"}
          </button>

          {notice && (
            <p className="mt-3 text-sm font-semibold text-[#51CF66]">{notice}</p>
          )}
          {error && <p className="mt-3 text-sm text-[#E67700]">{error}</p>}
        </form>

        <div className="space-y-4">
          {loading && <p className="text-sm text-[#6B7280]">加载申请留言中…</p>}

          {!loading && entries.length === 0 && (
            <div className="rounded-[18px] border border-dashed border-[#F2E6C9] bg-white/80 px-4 py-10 text-center text-sm text-[#6B7280]">
              还没有友链申请留言，欢迎留下第一条。
            </div>
          )}

          {entries.map((item) => {
            const tone = cardTone(item);
            const label =
              item.isAdminUser ? "站长" : item.isLoginUser ? "已登录" : "访客";

            return (
              <article
                key={item.id}
                className={clsx(
                  "relative rounded-[18px] border p-5 shadow-[0_8px_24px_rgba(255,143,171,0.1)]",
                  tone === "guest" && "border-[#FFE066]/60 bg-[#FFF9DB]",
                  tone === "login" && "border-[#A5D8FF]/60 bg-[#E7F5FF]",
                  tone === "admin" && "border-[#FFC9C9]/70 bg-[#FFF0F6]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-bold text-[#2B2B2B]">
                      {item.nickname}
                      <span className="ml-2 text-xs font-normal text-[#6B7280]">
                        {label}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {item.ipRegion || "未知地区"} · {formatTime(item.createdAt)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-[#2B2B2B]">
                  {item.content}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FriendsApplicationBoard;

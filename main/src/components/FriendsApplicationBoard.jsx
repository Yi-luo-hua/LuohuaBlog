import { useEffect, useState } from "react";
import { FiMessageCircle, FiSend } from "react-icons/fi";

import { getGuestbook, postGuestbook } from "../services/guestbookApi";

const formatTime = (iso) => {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const FRIEND_TEMPLATE = `站点名称：
站点链接：
站点描述：
头像链接：
已添加本站友链：是`;

const quickNotes = [
  "留言会公开展示，请确认信息无误。",
  "站点头像建议使用长期稳定外链。",
  "通过审核后，会整理到上方小伙伴区域。",
];

const FriendsApplicationBoard = () => {
  const [entries, setEntries] = useState([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState(FRIEND_TEMPLATE);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    getGuestbook(24).then((items) => {
      if (cancelled) return;
      setEntries(items);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setNotice("");
    const row = await postGuestbook({
      name: name.trim() || "friend-signal",
      content,
    });
    setEntries((prev) => [row, ...prev].slice(0, 24));
    setContent(FRIEND_TEMPLATE);
    setNotice(
      row.offline ? "已本地保存，接口恢复后可再提交一次。" : "友链申请已送达。"
    );
    setSubmitting(false);
  };

  return (
    <section
      id="friends-guestbook"
      className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[rgba(17,20,38,0.56)] p-6 shadow-[0_30px_100px_rgba(6,8,18,0.34)] backdrop-blur-[24px] md:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(100,86,255,0.18),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(95,224,255,0.12),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/8" />

      <div className="relative">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/42">
            Terminal Guestbook
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
            终端留言板
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-white/50">
            在底部留言区填写站点信息即可申请友链。这里保留公开展示的留言流，方便后续核对与整理。
          </p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {quickNotes.map((item) => (
            <span
              key={item}
              className="inline-flex rounded-full border border-white/10 bg-white/6 px-4 py-2 text-xs leading-6 text-white/64"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.94fr)]">
          <form
            onSubmit={onSubmit}
            className="rounded-[30px] border border-white/10 bg-[rgba(10,13,27,0.72)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:p-6"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.22em] text-white/52">
              申请署名
            </label>
            <input
              type="text"
              maxLength={32}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：站长名 / 站点名"
              className="mt-3 min-h-[50px] w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-[#7c5cff]/60 focus:ring-2 focus:ring-[#7c5cff]/26"
            />

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.22em] text-white/52">
              留言内容
            </label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={500}
              rows={10}
              required
              className="mt-3 w-full rounded-[24px] border border-white/10 bg-white/6 px-4 py-4 text-sm leading-7 text-white outline-none transition placeholder:text-white/24 focus:border-[#7c5cff]/60 focus:ring-2 focus:ring-[#7c5cff]/26"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-6 text-white/44">
                留言会进入本站公开留言流，提交前请确认链接、头像与简介均为稳定可访问的地址。
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#5768ff,#b85cff)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(92,94,255,0.28)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#96a0ff]"
              >
                <FiSend className="h-4 w-4" aria-hidden />
                {submitting ? "发送中..." : "提交申请"}
              </button>
            </div>

            {notice && <p className="mt-4 text-sm font-medium text-[#92ffe2]">{notice}</p>}
          </form>

          <div className="rounded-[30px] border border-white/10 bg-[rgba(20,24,43,0.72)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/42">
                  Recent Messages
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-white">最新留言</h3>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-[#96a0ff]">
                <FiMessageCircle className="h-3.5 w-3.5" aria-hidden />
                Public
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-5 text-sm text-white/58">
                  正在读取留言...
                </div>
              ) : entries.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-white/14 bg-white/6 px-4 py-5 text-sm text-white/58">
                  还没有新的申请记录，欢迎成为这里的第一条连接。
                </div>
              ) : (
                entries.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4 backdrop-blur-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{row.name}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[#96a0ff]">
                          Friend Request
                        </p>
                      </div>
                      <time className="shrink-0 text-[11px] text-white/36">
                        {formatTime(row.createdAt)}
                      </time>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-white/74">
                      {row.content}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FriendsApplicationBoard;

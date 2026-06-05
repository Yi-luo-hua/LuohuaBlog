import { useEffect, useState } from "react";
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
  "留言会公开展示，提交前请确认信息无误。",
  "头像建议使用长期稳定的外链地址。",
  "申请通过后，会同步出现在上方小伙伴区域。",
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
    <section className="relative overflow-hidden rounded-[34px] border border-[#102a24]/10 bg-white/72 p-6 shadow-[0_24px_80px_rgba(16,42,36,0.08)] backdrop-blur-xl md:p-8">
      <div
        className="pointer-events-none absolute -right-16 top-4 h-40 w-40 rounded-full bg-[#e6b85c]/16 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-14 bottom-8 h-36 w-36 rounded-full bg-[#6fae9b]/16 blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#8f6d2f]">
            Guestbook
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#102a24]">
            申请友链留言区
          </h2>
          <p className="mt-4 text-sm leading-8 text-[#1f221d]/68">
            最下面保留留言申请区，方便直接在同一个页面完成申请。按模板填写后提交即可，审核通过后会整理到上方的小伙伴卡片里。
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {quickNotes.map((item) => (
            <span
              key={item}
              className="inline-flex rounded-full border border-[#102a24]/10 bg-[#f6efe2] px-4 py-2 text-xs leading-6 text-[#1f221d]/70"
            >
              {item}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <form
            onSubmit={onSubmit}
            className="rounded-[30px] border border-[#102a24]/10 bg-[#fffdf8]/92 p-5 shadow-[0_18px_48px_rgba(16,42,36,0.06)] md:p-6"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[#102a24]/64">
              申请署名
            </label>
            <input
              type="text"
              maxLength={32}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：站长名 / 站点名"
              className="mt-3 min-h-[48px] w-full rounded-2xl border border-[#102a24]/10 bg-white px-4 py-3 text-sm text-[#1f221d] outline-none transition focus:border-[#6fae9b] focus:ring-2 focus:ring-[#6fae9b]/20"
            />

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#102a24]/64">
              留言内容
            </label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={500}
              rows={10}
              required
              className="mt-3 w-full rounded-[24px] border border-[#102a24]/10 bg-white px-4 py-4 text-sm leading-7 text-[#1f221d] outline-none transition focus:border-[#6fae9b] focus:ring-2 focus:ring-[#6fae9b]/20"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-6 text-[#1f221d]/55">
                留言会进入本站公开留言流，提交前请确认链接、头像与简介均为稳定可访问的地址。
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#102a24] px-6 py-3 text-sm font-semibold text-[#f8f5ee] transition hover:bg-[#15382f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "发送中..." : "提交申请"}
              </button>
            </div>

            {notice && (
              <p className="mt-4 text-sm font-medium text-[#2b7a67]">{notice}</p>
            )}
          </form>

          <div className="rounded-[30px] border border-[#102a24]/10 bg-[#f8f1e3] p-5 shadow-[0_18px_48px_rgba(16,42,36,0.05)] md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#8f6d2f]">
                  Recent Notes
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-[#102a24]">
                  最新留言
                </h3>
              </div>
              <span className="rounded-full border border-[#102a24]/10 bg-white/75 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#6b9f8f]">
                Public
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="rounded-[22px] border border-[#102a24]/10 bg-white/70 px-4 py-5 text-sm text-[#1f221d]/62">
                  正在读取留言...
                </div>
              ) : entries.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[#102a24]/14 bg-white/70 px-4 py-5 text-sm text-[#1f221d]/62">
                  还没有新的申请记录，欢迎成为第一页的第一条留言。
                </div>
              ) : (
                entries.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-[22px] border border-[#102a24]/10 bg-white/78 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#102a24]">
                          {row.name}
                        </p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[#6b9f8f]">
                          Friend Request
                        </p>
                      </div>
                      <time className="shrink-0 text-[11px] text-[#1f221d]/42">
                        {formatTime(row.createdAt)}
                      </time>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#1f221d]/74">
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

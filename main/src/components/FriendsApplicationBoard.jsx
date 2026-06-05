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
    <section className="relative overflow-hidden rounded-[34px] border border-white/75 bg-white/58 p-6 shadow-[0_26px_80px_rgba(16,42,36,0.12)] backdrop-blur-xl md:p-8">
      <div
        className="pointer-events-none absolute -right-16 top-0 h-44 w-44 rounded-full bg-[#E6B85C]/18 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-14 bottom-8 h-36 w-36 rounded-full bg-[#6FAE9B]/20 blur-3xl"
        aria-hidden
      />

      <div className="relative">
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#6FAE9B]">
            Link Application Console
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#102A24] md:text-3xl">
            申请友链留言区
          </h2>
          <p className="mt-3 text-sm leading-7 text-[#1A1D1A]/70">
            这里复用本站现有留言能力来接收友链申请。建议按模板填写，方便后续统一核对与添加。
          </p>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <form
            onSubmit={onSubmit}
            className="rounded-[28px] border border-[#102A24]/10 bg-[#FDFBF6]/92 p-5 shadow-[0_18px_48px_rgba(16,42,36,0.06)] md:p-6"
          >
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-[#102A24]/70">
              申请署名
            </label>
            <input
              type="text"
              maxLength={32}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：站长名 / 站点名"
              className="mt-3 min-h-[48px] w-full rounded-2xl border border-[#102A24]/10 bg-white px-4 py-3 text-sm text-[#1A1D1A] outline-none transition focus:border-[#6FAE9B] focus:ring-2 focus:ring-[#6FAE9B]/20"
            />

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.2em] text-[#102A24]/70">
              申请内容
            </label>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={500}
              rows={9}
              required
              className="mt-3 w-full rounded-[24px] border border-[#102A24]/10 bg-white px-4 py-4 text-sm leading-7 text-[#1A1D1A] outline-none transition focus:border-[#6FAE9B] focus:ring-2 focus:ring-[#6FAE9B]/20"
            />

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-6 text-[#1A1D1A]/55">
                留言会进入本站公开留言流，提交前请确认链接、头像与简介均为稳定地址。
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#102A24] px-6 py-3 text-sm font-semibold text-[#F8F5EE] transition hover:bg-[#15382F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "发送中..." : "提交申请"}
              </button>
            </div>

            {notice && (
              <p className="mt-4 text-sm font-medium text-[#2B7A67]">{notice}</p>
            )}
          </form>

          <div className="rounded-[28px] border border-[#102A24]/10 bg-[#102A24] p-5 text-[#F8F5EE] shadow-[0_18px_48px_rgba(16,42,36,0.16)] md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-[#E6B85C]">
                  Recent Signals
                </p>
                <h3 className="mt-2 text-xl font-semibold">近期留言流</h3>
              </div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#6FAE9B]">
                Live
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <div className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-5 text-sm text-white/65">
                  正在读取留言流...
                </div>
              ) : entries.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-white/18 bg-white/6 px-4 py-5 text-sm text-white/70">
                  还没有新的申请记录，可以成为第一条信号。
                </div>
              ) : (
                entries.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-[22px] border border-white/10 bg-white/6 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#F8F5EE]">{row.name}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[#6FAE9B]">
                          Incoming Link Request
                        </p>
                      </div>
                      <time className="shrink-0 text-[11px] text-white/50">
                        {formatTime(row.createdAt)}
                      </time>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-white/78">
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

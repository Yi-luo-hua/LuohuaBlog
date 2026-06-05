import { useState } from "react";
import { FiCopy, FiExternalLink, FiLink2 } from "react-icons/fi";

import FriendsApplicationBoard from "../components/FriendsApplicationBoard";

const FRIENDS_BG =
  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/8850f2efda188bd1dabdd68b7cb47ddd.jpg";

const floatingWhispers = [
  { text: "在云端相遇", top: "11%", left: "7%" },
  { text: "等待新的连接", top: "14%", right: "8%" },
  { text: "友链会记住来过的人", top: "36%", left: "10%" },
  { text: "这里收藏长期更新的小屋", top: "41%", right: "12%" },
  { text: "愿每个站点都有自己的光", top: "63%", left: "8%" },
  { text: "碎片化时代的慢链接", top: "68%", right: "10%" },
];

const particles = [
  { top: "8%", left: "12%", size: 8, delay: "0s" },
  { top: "15%", left: "64%", size: 10, delay: "0.8s" },
  { top: "21%", left: "86%", size: 6, delay: "1.4s" },
  { top: "28%", left: "17%", size: 9, delay: "0.3s" },
  { top: "39%", left: "72%", size: 12, delay: "1.1s" },
  { top: "47%", left: "33%", size: 7, delay: "1.8s" },
  { top: "55%", left: "89%", size: 9, delay: "0.6s" },
  { top: "67%", left: "19%", size: 11, delay: "1.6s" },
  { top: "74%", left: "58%", size: 8, delay: "0.9s" },
  { top: "84%", left: "78%", size: 10, delay: "1.9s" },
];

const friendCards = [
  {
    name: "连接开放中",
    desc: "这里会展示通过审核的小伙伴小屋。",
    avatar:
      "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png",
    url: "#friends-guestbook",
    status: "OPEN",
    glow: "from-[#7c5cff]/35 to-[#5ae4ff]/20",
    placeholder: true,
  },
  {
    name: "长期更新优先",
    desc: "欢迎有稳定内容输出与个人表达的站点。",
    avatar:
      "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png",
    url: "#friends-guestbook",
    status: "SIGNAL",
    glow: "from-[#a07cff]/30 to-[#ff8ec8]/18",
    placeholder: true,
  },
  {
    name: "等待你的申请",
    desc: "在下方留言区留下站点资料，就能接入这里。",
    avatar:
      "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png",
    url: "#friends-guestbook",
    status: "READY",
    glow: "from-[#57e6c1]/30 to-[#86a8ff]/18",
    placeholder: true,
  },
];

const siteFacts = [
  { label: "名称", value: "桃之夭夭" },
  { label: "简介", value: "桃之夭夭的小屋" },
  { label: "链接", value: "https://taozhiyy.top" },
  {
    label: "头像",
    value: "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png",
  },
];

const copyBlock = `name: 桃之夭夭
desc: 桃之夭夭的小屋
url: https://taozhiyy.top
avatar: https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png`;

const FriendSignalCard = ({ friend }) => {
  const isAnchor = friend.url.startsWith("#");

  return (
    <a
      href={friend.url}
      target={isAnchor ? undefined : "_blank"}
      rel={isAnchor ? undefined : "noreferrer"}
      className="group relative overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(22,25,43,0.6)] p-5 shadow-[0_22px_60px_rgba(7,10,24,0.28)] backdrop-blur-[18px] transition duration-300 hover:-translate-y-1 hover:border-[#7c5cff]/40 hover:bg-[rgba(26,30,52,0.72)]"
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${friend.glow} opacity-80 blur-2xl transition duration-300 group-hover:opacity-100`}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-[1px] rounded-[27px] border border-white/6" />

      <div className="relative flex items-center gap-4">
        <div className="rounded-[22px] border border-white/12 bg-white/6 p-1.5 shadow-[0_0_28px_rgba(124,92,255,0.14)]">
          <img
            src={friend.avatar}
            alt={friend.name}
            className="h-14 w-14 rounded-[18px] object-cover"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold tracking-[-0.02em] text-white">
            {friend.name}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7f8dff]">
            {friend.status}
          </p>
        </div>
      </div>

      <p className="relative mt-5 text-sm leading-7 text-white/72">{friend.desc}</p>

      <div className="relative mt-5 flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-white/36">
        <span>{friend.placeholder ? "Awaiting connection" : "Visit site"}</span>
        <FiExternalLink className="h-4 w-4" aria-hidden />
      </div>
    </a>
  );
};

const FriendsPage = () => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyBlock);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#090b16] pb-24 pt-20 text-white md:pt-24">
      <img
        src={FRIENDS_BG}
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-34 blur-[12px]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(87,93,170,0.28),transparent_36%),linear-gradient(180deg,rgba(8,10,20,0.72)_0%,rgba(8,11,24,0.82)_24%,rgba(10,12,25,0.88)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(4,7,18,0.48),transparent_24%,transparent_76%,rgba(7,9,18,0.42))]" />

      {floatingWhispers.map((item) => (
        <span
          key={`${item.text}-${item.top}`}
          className="pointer-events-none absolute hidden text-sm tracking-[0.08em] text-white/14 blur-[0.2px] lg:block"
          style={item}
        >
          {item.text}
        </span>
      ))}

      {particles.map((dot) => (
        <span
          key={`${dot.top}-${dot.left}`}
          className="pointer-events-none absolute rounded-full bg-[#9df7d5] opacity-70 shadow-[0_0_20px_rgba(145,255,221,0.95)] animate-pulse"
          style={{
            top: dot.top,
            left: dot.left,
            width: dot.size,
            height: dot.size,
            animationDelay: dot.delay,
          }}
          aria-hidden
        />
      ))}

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-28 bg-[linear-gradient(180deg,transparent,rgba(10,12,23,0.92))]" />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-[radial-gradient(circle_at_bottom,rgba(255,255,255,0.18),transparent_56%)] opacity-55" />

      <div className="relative mx-auto max-w-7xl px-4 md:px-6">
        <header className="pt-10 text-center md:pt-14">
          <p className="text-[11px] font-semibold uppercase tracking-[0.36em] text-white/45">
            Cloud Connection Layer
          </p>
          <h1 className="mt-6 text-4xl font-semibold tracking-[-0.05em] text-white md:text-6xl">
            云端引力
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-8 text-white/50 md:text-base">
            在这里收纳那些认真写字、稳定更新、有趣灵魂与长期主义的个人小屋。
          </p>
        </header>

        <section className="mx-auto mt-12 max-w-4xl">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {friendCards.map((friend) => (
              <FriendSignalCard key={friend.name} friend={friend} />
            ))}
          </div>
        </section>

        <section className="mx-auto mt-14 max-w-3xl">
          <div className="relative overflow-hidden rounded-[34px] border border-white/10 bg-[rgba(24,28,50,0.6)] p-6 text-center shadow-[0_30px_100px_rgba(6,8,18,0.36)] backdrop-blur-[24px] md:p-9">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,92,255,0.22),transparent_34%),radial-gradient(circle_at_bottom,rgba(90,228,255,0.12),transparent_32%)]" />
            <div className="pointer-events-none absolute inset-[1px] rounded-[33px] border border-white/8" />

            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#f0c98c]">
                Neural Link
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-white md:text-4xl">
                建立神经连接
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-white/52">
                欢迎交换友链。可以先复制下方格式，也可以直接前往底部留言区提交申请。
              </p>

              <div className="mx-auto mt-8 max-w-2xl rounded-[26px] border border-white/10 bg-[rgba(15,18,35,0.82)] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] md:p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tracking-[0.18em] text-white/64">
                      本站友链信息
                    </p>
                    <div className="mt-4 space-y-2 text-sm leading-7 text-white/84">
                      {siteFacts.map((item) => (
                        <p key={item.label} className="break-all">
                          <span className="text-white/48">{item.label}：</span>
                          {item.value}
                        </p>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-white/76 transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff]"
                    aria-label="复制友链信息"
                  >
                    <FiCopy className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#5f6bff,#aa54ff)] px-7 py-3 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(110,90,255,0.34)] transition hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92a2ff]"
                >
                  <FiCopy className="h-4 w-4" aria-hidden />
                  {copied ? "已复制" : "一键复制友链"}
                </button>

                <a
                  href="#friends-guestbook"
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-white/12 bg-white/8 px-7 py-3 text-sm font-semibold text-white/84 transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#92a2ff]"
                >
                  <FiLink2 className="h-4 w-4" aria-hidden />
                  前往留言区申请
                </a>
              </div>

              <pre className="mx-auto mt-8 max-w-xl overflow-x-auto whitespace-pre-wrap rounded-[24px] border border-white/10 bg-[rgba(9,12,26,0.72)] px-5 py-4 text-left text-sm leading-7 text-white/74">
                {copyBlock}
              </pre>
            </div>
          </div>
        </section>

        <div className="mx-auto mt-14 max-w-5xl">
          <FriendsApplicationBoard />
        </div>
      </div>
    </section>
  );
};

export default FriendsPage;

import { useState } from "react";
import { FiCopy } from "react-icons/fi";

import FriendsApplicationBoard from "../components/FriendsApplicationBoard";

const friendCards = [
  {
    name: "等待新的小伙伴",
    desc: "通过审核后，会作为卡片展示在这里。",
    note: "OPEN",
  },
  {
    name: "长期更新优先",
    desc: "更欢迎稳定创作、内容清晰的个人小屋。",
    note: "ACTIVE",
  },
  {
    name: "欢迎来交换友链",
    desc: "在下方留言区提交申请，我们会慢慢把这里填满。",
    note: "READY",
  },
];

const copyBlock = `name: 桃之夭夭
desc: 桃之夭夭的小屋
url: https://taozhiyy.top
avatar: https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png`;

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
    <section className="relative min-h-screen overflow-hidden bg-[#fffaf2] pb-24 pt-20 text-[#2B2B2B] md:pt-24">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(circle at 12% 16%, rgba(255, 214, 184, 0.3), transparent 22rem), radial-gradient(circle at 88% 14%, rgba(165, 216, 255, 0.24), transparent 24rem), linear-gradient(180deg, #fffaf2 0%, #fffdf7 48%, #f7fbff 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-[-4rem] top-40 h-56 w-56 rounded-full bg-[#FFD6B8]/28 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute right-[-4rem] top-56 h-60 w-60 rounded-full bg-[#DCEEFF]/28 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 md:px-6">
        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#B76E79]">
            Friends Page
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#2B2B2B] md:text-6xl">
            友链
          </h1>
          <p className="mt-5 text-base leading-8 text-[#6B7280] md:text-lg">
            这里保留最需要的三部分：小伙伴卡片、我的友链，以及申请友链的留言区。
          </p>
        </header>

        <section className="mt-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#74C0FC]">
                Friends Grid
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#2B2B2B]">
                小伙伴卡片
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[#6B7280]">
              这里会逐渐收进通过审核的小屋。现在先留出位置，等新的连接慢慢长出来。
            </p>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {friendCards.map((friend) => (
              <article
                key={friend.name}
                className="rounded-[24px] border border-[#F2E6C9] bg-white/90 p-5 shadow-[0_14px_34px_rgba(255,143,171,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_rgba(255,143,171,0.16)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#FFE6EC,#FFF5C8)] text-lg font-semibold text-[#B76E79] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
                      友
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-[#2B2B2B]">{friend.name}</p>
                      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#74C0FC]">
                        {friend.note}
                      </p>
                    </div>
                  </div>
                </div>
                <p className="mt-5 text-sm leading-7 text-[#6B7280]">{friend.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#74C0FC]">
                My Link
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#2B2B2B]">
                我的友链
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-7 text-[#6B7280]">
              这里只放标准四行信息，方便直接复制使用。
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-[28px] border border-[#F2E6C9] bg-white/92 shadow-[0_18px_48px_rgba(255,143,171,0.12)]">
            <div className="flex items-center justify-between border-b border-[#F7EBDD] bg-[linear-gradient(180deg,#FFFDF8,#FFF6EE)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#FF8FAB]" />
                <span className="h-3 w-3 rounded-full bg-[#FFD43B]" />
                <span className="h-3 w-3 rounded-full bg-[#74C0FC]" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#9AA4B2]">
                friend-card.yaml
              </p>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-[#F2E6C9] bg-white px-4 py-2 text-sm font-semibold text-[#5F4B52] transition hover:border-[#FFD43B] hover:text-[#2B2B2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#74C0FC]/30"
              >
                <FiCopy className="h-4 w-4" aria-hidden />
                {copied ? "已复制" : "复制"}
              </button>
            </div>

            <pre className="overflow-x-auto bg-[#FFFDFC] px-5 py-5 text-sm leading-8 text-[#2B2B2B] md:px-6 md:py-6">
              {copyBlock}
            </pre>
          </div>
        </section>

        <div className="mt-12">
          <FriendsApplicationBoard />
        </div>
      </div>
    </section>
  );
};

export default FriendsPage;

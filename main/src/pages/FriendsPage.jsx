import FriendsApplicationBoard from "../components/FriendsApplicationBoard";

const siteFacts = [
  { label: "站点名称", value: "桃之夭夭" },
  { label: "站点链接", value: "https://bistutzyy.github.io" },
  { label: "站点描述", value: "记录热爱、创作与长期主义的个人空间。" },
  {
    label: "头像链接",
    value: "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png",
  },
];

const applicationRules = [
  "请先添加本站友链，再来这里留言申请。",
  "请提供站点名称、站点链接、简短描述与头像地址。",
  "头像和站点链接尽量使用长期稳定的公开地址。",
  "如果站点内容长期失效或不再更新，友链可能会被调整。",
];

const FriendsPage = () => (
  <section className="relative min-h-screen overflow-hidden bg-[#F8F5EE] pb-24 pt-20 text-[#1A1D1A] md:pt-24">
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{
        background:
          "radial-gradient(circle at 12% 14%, rgba(111,174,155,0.18), transparent 24rem), radial-gradient(circle at 84% 20%, rgba(230,184,92,0.18), transparent 20rem), linear-gradient(180deg, #F8F5EE 0%, #F4F7F0 52%, #EEF6F3 100%)",
      }}
    />
    <div
      className="pointer-events-none absolute left-[-5rem] top-36 h-64 w-64 rounded-full bg-[#6FAE9B]/18 blur-3xl"
      aria-hidden
    />
    <div
      className="pointer-events-none absolute right-[-4rem] top-52 h-56 w-56 rounded-full bg-[#E6B85C]/16 blur-3xl"
      aria-hidden
    />

    <div className="relative mx-auto max-w-6xl px-4 md:px-6">
      <header className="max-w-3xl pt-10 md:pt-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#6FAE9B]">
          Signal Exchange Node
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#102A24] md:text-6xl">
          Friends
        </h1>
        <p className="mt-5 text-base leading-8 text-[#1A1D1A]/72 md:text-lg">
          这里是本站统一的友链通信站。你可以先查看本站信息，再阅读申请说明，最后直接在下方留言区提交友链申请。
        </p>
      </header>

      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-[34px] border border-white/80 bg-white/55 p-6 shadow-[0_24px_80px_rgba(16,42,36,0.08)] backdrop-blur-xl md:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6FAE9B]">
                Site Profile
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[#102A24]">本站信息</h2>
            </div>
            <div className="rounded-[26px] border border-[#102A24]/10 bg-[#F8F5EE] p-2">
              <img
                src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png"
                alt="本站头像"
                className="h-16 w-16 rounded-[20px] object-cover"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {siteFacts.map((item) => (
              <article
                key={item.label}
                className="rounded-[26px] border border-[#102A24]/10 bg-[#FDFBF6]/90 p-5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6FAE9B]">
                  {item.label}
                </p>
                <p className="mt-3 break-all text-sm leading-7 text-[#1A1D1A]/80">
                  {item.value}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[28px] border border-dashed border-[#102A24]/18 bg-[#102A24] p-5 text-[#F8F5EE] md:p-6">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#E6B85C]">
              Copy Friendly
            </p>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-white/88">
{`name: 桃之夭夭
url: https://bistutzyy.github.io
desc: 记录热爱、创作与长期主义的个人空间。
avatar: https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png`}
            </pre>
          </div>
        </section>

        <section className="rounded-[34px] border border-white/80 bg-white/55 p-6 shadow-[0_24px_80px_rgba(16,42,36,0.08)] backdrop-blur-xl md:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6FAE9B]">
            Exchange Guide
          </p>
          <h2 className="mt-3 text-2xl font-semibold text-[#102A24]">申请友链说明</h2>
          <p className="mt-4 text-sm leading-7 text-[#1A1D1A]/72">
            首版只保留最核心的申请流程，不展示历史友链列表。你只需要按下面要求准备信息，然后在留言区提交即可。
          </p>

          <div className="mt-6 space-y-3">
            {applicationRules.map((rule, index) => (
              <div
                key={rule}
                className="flex gap-4 rounded-[24px] border border-[#102A24]/10 bg-[#FDFBF6]/90 px-4 py-4"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#102A24] text-sm font-semibold text-[#F8F5EE]">
                  0{index + 1}
                </span>
                <p className="pt-1 text-sm leading-7 text-[#1A1D1A]/78">{rule}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[28px] border border-[#6FAE9B]/25 bg-[linear-gradient(135deg,rgba(111,174,155,0.14),rgba(230,184,92,0.12))] p-5 md:p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#102A24]/60">
              留言模板
            </p>
            <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-[#102A24]">
{`站点名称：
站点链接：
站点描述：
头像链接：
已添加本站友链：是`}
            </pre>
          </div>
        </section>
      </div>

      <div className="mt-8">
        <FriendsApplicationBoard />
      </div>
    </div>
  </section>
);

export default FriendsPage;

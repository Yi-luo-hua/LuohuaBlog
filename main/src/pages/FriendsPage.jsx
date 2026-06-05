import FriendsApplicationBoard from "../components/FriendsApplicationBoard";

const friendCards = [];

const friendNotes = [
  {
    title: "等待第一位小伙伴",
    body: "留言申请通过后，会以卡片的形式展示在这里。",
  },
  {
    title: "偏爱长期更新",
    body: "更欢迎有稳定内容输出、风格明确的个人小屋。",
  },
  {
    title: "链接尽量稳定",
    body: "头像、简介与站点链接保持长期可访问，会更方便互访。",
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

const applicationRules = [
  "请先添加本站友链，再来这里留言申请。",
  "请提供站点名称、站点链接、简介与头像地址。",
  "默认会优先收录内容正常、可访问、长期更新的小屋。",
];

const copyBlock = `name: 桃之夭夭
desc: 桃之夭夭的小屋
url: https://taozhiyy.top
avatar: https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png`;

const FriendsPage = () => (
  <section className="relative min-h-screen overflow-hidden bg-[#f7f1e7] pb-24 pt-20 text-[#1f221d] md:pt-24">
    <div
      className="pointer-events-none absolute inset-0"
      aria-hidden
      style={{
        background:
          "radial-gradient(circle at 14% 18%, rgba(230,184,92,0.18), transparent 22rem), radial-gradient(circle at 88% 14%, rgba(111,174,155,0.18), transparent 24rem), linear-gradient(180deg, #f7f1e7 0%, #fbf7ef 54%, #f3efe4 100%)",
      }}
    />
    <div
      className="pointer-events-none absolute left-[-4rem] top-40 h-52 w-52 rounded-full bg-[#e6b85c]/16 blur-3xl"
      aria-hidden
    />
    <div
      className="pointer-events-none absolute right-[-5rem] top-56 h-64 w-64 rounded-full bg-[#6fae9b]/14 blur-3xl"
      aria-hidden
    />

    <div className="relative mx-auto max-w-6xl px-4 md:px-6">
      <header className="max-w-3xl pt-10 md:pt-14">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#8f6d2f]">
          Friends Corner
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#102a24] md:text-6xl">
          友链小屋
        </h1>
        <p className="mt-5 text-base leading-8 text-[#1f221d]/72 md:text-lg">
          这里参考了你喜欢的友链页结构，把小伙伴展示放在最上面，中间整理成本站友链资料卡，最下方保留留言申请区，整体更像一个轻松、温柔的交换角落。
        </p>
      </header>

      <section className="mt-12">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6b9f8f]">
              Our Friends
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#102a24]">
              小伙伴们
            </h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-[#1f221d]/62">
            审核通过的小屋会收进这里，放在页面最上面，方便第一眼就看到彼此之间的连接。
          </p>
        </div>

        {friendCards.length > 0 ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {friendCards.map((friend) => (
              <a
                key={friend.name}
                href={friend.url}
                target="_blank"
                rel="noreferrer"
                className="group rounded-[30px] border border-[#102a24]/10 bg-[#fffdf8]/92 p-5 shadow-[0_18px_48px_rgba(16,42,36,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(16,42,36,0.12)]"
              >
                <div className="flex items-center gap-4">
                  <img
                    src={friend.avatar}
                    alt={friend.name}
                    className="h-16 w-16 rounded-[22px] object-cover"
                  />
                  <div>
                    <p className="text-lg font-semibold text-[#102a24]">
                      {friend.name}
                    </p>
                    <p className="mt-1 text-sm text-[#1f221d]/64">{friend.desc}</p>
                  </div>
                </div>
                <span className="mt-5 inline-flex rounded-full border border-[#102a24]/10 bg-[#f6efe2] px-4 py-2 text-xs font-semibold tracking-[0.18em] text-[#8f6d2f]">
                  Visit
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)_minmax(0,0.65fr)]">
            <article className="rounded-[32px] border border-[#102a24]/10 bg-[#fffdf8]/92 p-6 shadow-[0_18px_48px_rgba(16,42,36,0.08)] md:p-7">
              <div className="inline-flex rounded-full border border-[#e6b85c]/35 bg-[#fff3d9] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#8f6d2f]">
                Ready For New Friends
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-[#102a24]">
                这里会慢慢住进新的小伙伴
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-[#1f221d]/68">
                现在顶部卡片区先预留出来，等友链申请通过后，就会按这种轻松的小卡片方式展示在这里。这样页面打开后，最先看到的就是互相串门的小屋们。
              </p>
            </article>

            {friendNotes.map((item) => (
              <article
                key={item.title}
                className="rounded-[28px] border border-[#102a24]/10 bg-[#f8f1e3]/90 p-5 shadow-[0_16px_40px_rgba(16,42,36,0.05)]"
              >
                <p className="text-sm font-semibold text-[#102a24]">{item.title}</p>
                <p className="mt-3 text-sm leading-7 text-[#1f221d]/62">{item.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-[34px] border border-[#102a24]/10 bg-white/70 p-6 shadow-[0_24px_80px_rgba(16,42,36,0.08)] backdrop-blur-xl md:p-8">
        <div className="grid gap-8 lg:grid-cols-[minmax(280px,0.75fr)_minmax(0,1.25fr)]">
          <aside className="rounded-[30px] border border-[#102a24]/10 bg-[#f6efe2] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] md:p-6">
            <div className="rounded-[28px] border border-white/80 bg-white/78 p-4">
              <img
                src="https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png"
                alt="桃之夭夭"
                className="h-20 w-20 rounded-[24px] object-cover"
              />
              <h3 className="mt-4 text-2xl font-semibold text-[#102a24]">桃之夭夭</h3>
              <p className="mt-3 text-sm leading-7 text-[#1f221d]/68">
                桃之夭夭的小屋
              </p>
              <a
                href="https://taozhiyy.top"
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex rounded-full border border-[#102a24]/10 bg-[#102a24] px-5 py-2.5 text-sm font-semibold text-[#f8f5ee]"
              >
                https://taozhiyy.top
              </a>
            </div>

            <div className="mt-5 rounded-[26px] border border-[#102a24]/10 bg-[#fffaf1] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8f6d2f]">
                申请前
              </p>
              <div className="mt-4 space-y-3">
                {applicationRules.map((rule) => (
                  <p
                    key={rule}
                    className="rounded-[20px] border border-[#102a24]/8 bg-white/78 px-4 py-3 text-sm leading-7 text-[#1f221d]/70"
                  >
                    {rule}
                  </p>
                ))}
              </div>
            </div>
          </aside>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#6b9f8f]">
              My Link Info
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-[#102a24]">
              本站友链信息
            </h2>
            <p className="mt-4 text-sm leading-8 text-[#1f221d]/68">
              中间这块专门放本站的友链资料，尽量做得清楚、整洁一点，方便别人直接复制使用。你刚刚确认的正式信息我已经按这一版写进去了。
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {siteFacts.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[24px] border border-[#102a24]/10 bg-[#fffdf8]/92 p-5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6b9f8f]">
                    {item.label}
                  </p>
                  <p className="mt-3 break-all text-sm leading-7 text-[#1f221d]/78">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-[28px] border border-dashed border-[#102a24]/16 bg-[#102a24] p-5 text-[#f8f5ee] md:p-6">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#e6b85c]">
                可直接复制
              </p>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-sm leading-7 text-white/88">
                {copyBlock}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-10">
        <FriendsApplicationBoard />
      </div>
    </div>
  </section>
);

export default FriendsPage;

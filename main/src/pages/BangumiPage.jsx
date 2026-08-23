import { useCallback, useState } from "react";
import { NavLink, Navigate, useParams } from "react-router-dom";
import BangumiShelf from "../components/BangumiShelf";

const COLLECTIONS = [
  {
    key: "watching",
    label: "在看",
  },
  {
    key: "watched",
    label: "看过",
  },
  {
    key: "wish",
    label: "想看",
  },
];

const emptyCounts = { watching: 0, watched: 0, wish: 0 };

const BangumiPage = () => {
  const { status = "watching" } = useParams();
  const current = COLLECTIONS.find((item) => item.key === status);
  const [counts, setCounts] = useState(emptyCounts);
  const handleCounts = useCallback((nextCounts) => setCounts(nextCounts), []);

  if (!current) return <Navigate to="/bangumi/watching" replace />;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f4f0e8] pb-20 pt-24 text-[#172d40]">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 8% 8%, rgba(232,132,116,.2), transparent 26%), radial-gradient(circle at 88% 22%, rgba(123,170,190,.24), transparent 30%), linear-gradient(rgba(23,45,64,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(23,45,64,.035) 1px, transparent 1px)",
          backgroundSize: "auto, auto, 48px 48px, 48px 48px",
        }}
      />

      <main className="container relative mx-auto px-4 md:px-10">
        <nav
          className="mb-10 grid grid-cols-3 gap-2 rounded-[1.6rem] border border-[#172d40]/10 bg-[#fffdf8]/65 p-2 shadow-[0_14px_35px_rgba(52,72,92,0.08)] backdrop-blur sm:inline-grid sm:min-w-[30rem]"
          aria-label="Bangumi 收藏分类"
        >
          {COLLECTIONS.map((item) => (
            <NavLink
              key={item.key}
              to={`/bangumi/${item.key}`}
              className={({ isActive }) =>
                `group flex min-w-0 items-center justify-center gap-2 rounded-[1.1rem] px-3 py-3 text-sm transition-all duration-300 sm:px-5 ${
                  isActive
                    ? "bg-[#172d40] text-[#fffdf8] shadow-[0_8px_18px_rgba(23,45,64,0.2)]"
                    : "text-[#526976] hover:bg-[#e8ede9] hover:text-[#172d40]"
                }`
              }
            >
              <span className="font-semibold">{item.label}</span>
              <span className="bg-current/10 rounded-full px-1.5 font-mono text-[10px] opacity-75">
                {counts[item.key]}
              </span>
            </NavLink>
          ))}
        </nav>

        <section key={status} aria-labelledby="collection-title">
          <div className="mb-6 flex items-center justify-between gap-4">
            <h2
              id="collection-title"
              className="font-mono text-xs uppercase tracking-[0.3em] text-[#315c72]"
            >
              {current.label}清单
            </h2>
            <a
              href="https://bgm.tv/user/936756"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#71838d] transition-colors hover:text-[#d2685a]"
            >
              我的 Bangumi 主页 ↗
            </a>
          </div>
          <BangumiShelf status={status} onCounts={handleCounts} />
        </section>
      </main>
    </div>
  );
};

export default BangumiPage;

import { useEffect, useMemo, useState } from "react";
import { fetchChatStats } from "../services/chatStatsApi";

const maxBar = (rows, pick) => {
  let m = 1;
  for (const row of rows) {
    const v = pick(row);
    if (v > m) m = v;
  }
  return m;
};

const BarChart = ({ rows, pick, barClass, emptyLabel }) => {
  const peak = maxBar(rows, pick);
  if (!rows.length || peak <= 0) {
    return (
      <p className="text-sm text-blue-50/50">{emptyLabel}</p>
    );
  }
  return (
    <div className="flex h-44 items-end gap-1 sm:gap-2">
      {rows.map((row) => {
        const v = pick(row);
        const h = v > 0 ? Math.max(8, Math.round((v / peak) * 100)) : 4;
        return (
          <div
            key={row.key}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`${row.label}: ${v}`}
          >
            <div
              className={`w-full max-w-[28px] rounded-t-md transition-all ${barClass}`}
              style={{ height: `${h}%` }}
            />
            <span className="truncate text-[9px] text-blue-50/60 sm:text-[10px]">
              {row.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const StatCard = ({ label, value, hint }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
    <p className="text-[10px] uppercase tracking-[0.25em] text-blue-50/50">{label}</p>
    <p className="mt-1 font-zentry text-2xl font-black text-yellow-300 md:text-3xl">{value}</p>
    {hint ? <p className="mt-1 text-xs text-blue-50/55">{hint}</p> : null}
  </div>
);

const AiTrafficPage = () => {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchChatStats(14);
        if (!cancelled) setStats(data);
      } catch (e) {
        if (!cancelled) setError(e.message || "加载失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dailyBars = useMemo(() => {
    if (!stats?.daily?.length) return [];
    return stats.daily.map((d) => ({
      key: d.date,
      label: d.date.slice(5),
      total: d.total,
      success: d.success,
    }));
  }, [stats]);

  const hourlyBars = useMemo(() => {
    if (!stats?.hourlyToday?.length) return [];
    return stats.hourlyToday.map((h) => ({
      key: h.hour,
      label: h.hour,
      total: h.total,
      success: h.success,
    }));
  }, [stats]);

  const summary = stats?.summary;

  return (
    <section className="relative min-h-screen bg-black pb-24 pt-24 text-blue-50">
      <div className="container mx-auto px-3 md:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-yellow-300/80">
          DeepSeek Monitor
        </p>
        <h1 className="mt-2 font-zentry text-4xl font-black uppercase text-blue-50 md:text-6xl">
          AI 调用流量
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-blue-50/70">
          全站博客小精灵经后端转发至{" "}
          <span className="text-yellow-300">{stats?.model || "deepseek-v4-flash"}</span>
          。此处展示聚合调用量（不含用户身份与聊天内容）。部署本版本后开始累计。
        </p>

        {loading && (
          <p className="mt-10 text-sm text-blue-50/50">加载统计中…</p>
        )}
        {error && (
          <p className="mt-10 rounded-lg border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {stats && !error && (
          <>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="今日成功调用"
                value={summary?.todaySuccess ?? 0}
                hint={`今日请求 ${summary?.todayTotal ?? 0} 次`}
              />
              <StatCard
                label="近 14 日成功"
                value={summary?.periodSuccess ?? 0}
                hint={`合计 ${summary?.periodTotal ?? 0} 次`}
              />
              <StatCard
                label="成功率"
                value={summary?.successRateText ?? "0%"}
                hint="成功 / 全部请求（含额度与限流）"
              />
              <StatCard
                label="服务状态"
                value={stats.configured ? "已配置" : "未配置"}
                hint={stats.configured ? "Key 已在服务器就绪" : "等待 DEEPSEEK_API_KEY"}
              />
            </div>

            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-8">
              <h2 className="text-lg font-bold text-yellow-300">近 14 日每日流量</h2>
              <p className="mt-1 text-xs text-blue-50/55">柱高 = 当日总请求（成功 + 失败 + 限流）</p>
              <div className="mt-6">
                <BarChart
                  rows={dailyBars}
                  pick={(r) => r.total}
                  barClass="bg-gradient-to-t from-violet-600 to-yellow-400"
                  emptyLabel="暂无历史数据，开始使用小精灵后即可看到曲线。"
                />
              </div>
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 md:p-8">
              <h2 className="text-lg font-bold text-yellow-300">今日按小时（UTC）</h2>
              <p className="mt-1 text-xs text-blue-50/55">绿色系为成功调用占比提示</p>
              <div className="mt-6">
                <BarChart
                  rows={hourlyBars}
                  pick={(r) => r.success || r.total}
                  barClass="bg-gradient-to-t from-emerald-700 to-emerald-300"
                  emptyLabel="今日尚无调用记录。"
                />
              </div>
            </div>

            {stats.daily?.length > 0 && (
              <div className="mt-8 overflow-x-auto rounded-xl border border-white/10">
                <table className="min-w-full text-left text-xs text-blue-50/80">
                  <thead className="bg-white/5 uppercase tracking-wider text-blue-50/50">
                    <tr>
                      <th className="px-4 py-3">日期</th>
                      <th className="px-4 py-3">成功</th>
                      <th className="px-4 py-3">上游失败</th>
                      <th className="px-4 py-3">额度拒绝</th>
                      <th className="px-4 py-3">限流</th>
                      <th className="px-4 py-3">游客</th>
                      <th className="px-4 py-3">登录</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...stats.daily].reverse().map((d) => (
                      <tr key={d.date} className="border-t border-white/5">
                        <td className="px-4 py-2">{d.date}</td>
                        <td className="px-4 py-2 text-emerald-300">{d.success}</td>
                        <td className="px-4 py-2">{d.upstreamError}</td>
                        <td className="px-4 py-2">{d.quotaDenied}</td>
                        <td className="px-4 py-2">{d.rateDenied}</td>
                        <td className="px-4 py-2">{d.guestCalls}</td>
                        <td className="px-4 py-2">{d.userCalls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default AiTrafficPage;

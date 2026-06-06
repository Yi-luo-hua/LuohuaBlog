export function getOwnerSessionLabel(auth) {
  if (!auth?.loggedIn) return "Owner not confirmed";
  if (auth?.user?.isOwner && !auth?.unlimited) return "Owner security pending";
  return auth?.user?.displayName || auth?.user?.email || "Owner";
}

export function getBackendHealthLabel(health) {
  return health?.status || "checking";
}

export function getStatsSnapshot(stats) {
  const summary = stats?.summary || {};
  return {
    configured: Boolean(stats?.configured),
    model: stats?.model || "unknown",
    today: `${summary.todaySuccess ?? 0} / ${summary.todayTotal ?? 0}`,
    period: `${summary.periodSuccess ?? 0} / ${summary.periodTotal ?? 0}`,
    successRate: summary.successRateText || "0%",
  };
}

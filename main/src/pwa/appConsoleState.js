export function getOwnerSessionLabel(auth) {
  if (!auth?.loggedIn) return "站长未确认";
  if (auth?.user?.isOwner && !auth?.unlimited) return "站长安全验证待完成";
  return auth?.user?.displayName || auth?.user?.email || "站长";
}

export function getBackendHealthLabel(health) {
  return health?.status || "检查中";
}

export function getStatsSnapshot(stats) {
  const summary = stats?.summary || {};
  return {
    configured: Boolean(stats?.configured),
    model: stats?.model || "未知模型",
    today: `${summary.todaySuccess ?? 0} / ${summary.todayTotal ?? 0}`,
    period: `${summary.periodSuccess ?? 0} / ${summary.periodTotal ?? 0}`,
    successRate: summary.successRateText || "0%",
  };
}

export function getOwnerRegisteredUsers(ownerStatus) {
  return ownerStatus?.users?.registered || [];
}

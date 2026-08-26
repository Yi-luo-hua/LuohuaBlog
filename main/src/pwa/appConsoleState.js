export function getOwnerSessionLabel(ownerStatus) {
  if (!ownerStatus?.owner) return "未解锁";
  return ownerStatus.owner.displayName || "站长";
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

export function getOwnerGuestbookContacts(ownerEmails) {
  const items = ownerEmails?.guestbookContacts;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item?.contactEmail)
    .map((item) => ({
      id: item.id,
      source: item.source || "",
      nickname: item.nickname || "",
      content: item.content || "",
      contactEmail: item.contactEmail,
      createdAt: item.createdAt || "",
    }));
}

export function getOwnerFixedAnswers(ownerStatus) {
  const items = ownerStatus?.ai?.fixedAnswers;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item?.question && item?.answer)
    .map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer,
      status: item.status || "active",
      createdAt: item.createdAt || "",
      updatedAt: item.updatedAt || "",
    }));
}

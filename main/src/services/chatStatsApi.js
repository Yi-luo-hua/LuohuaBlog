export async function fetchChatStats(days = 14) {
  const res = await fetch(`/api/chat/stats?days=${days}`, {
    headers: { Accept: "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || "加载统计失败");
  }
  return data;
}

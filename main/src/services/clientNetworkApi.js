export async function measureClientNetwork({
  fetchImpl = fetch,
  now = () => performance.now(),
} = {}) {
  const startedAt = now();
  const res = await fetchImpl(`/api/client/network?ts=${Date.now()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  const latencyMs = Math.max(0, Math.round(now() - startedAt));
  return {
    regionLabel: data.regionLabel || "访客",
    ipMasked: data.ipMasked || "",
    serverTime: data.serverTime || "",
    latencyMs,
  };
}

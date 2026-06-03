import { mockBangumiList, mockRadarList } from "../data/acgMock";
import { apiUrl } from "../lib/apiBase";

async function fetchJson(path) {
  const res = await fetch(apiUrl(path), {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("not json");
  }
  return res.json();
}

export async function getBangumiList() {
  try {
    const data = await fetchJson("/api/v1/bangumi/list");
    return Array.isArray(data?.items) ? data.items : data;
  } catch {
    return mockBangumiList;
  }
}

export async function getRadarFeed() {
  try {
    const data = await fetchJson("/api/v1/radar/feed");
    return Array.isArray(data?.items) ? data.items : data;
  } catch {
    return mockRadarList;
  }
}

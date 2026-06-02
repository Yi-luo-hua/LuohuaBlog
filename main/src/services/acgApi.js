import { mockBangumiList, mockRadarList } from "../data/acgMock";
import { apiUrl } from "../lib/apiBase";
import { normalizeList } from "../lib/normalizeList";

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
    return normalizeList(data, mockBangumiList);
  } catch {
    return mockBangumiList;
  }
}

export async function getRadarFeed() {
  try {
    const data = await fetchJson("/api/v1/radar/feed");
    return normalizeList(data, mockRadarList);
  } catch {
    return mockRadarList;
  }
}

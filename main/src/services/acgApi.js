import { apiUrl } from "../lib/apiBase.js";
import { asList } from "../lib/asList.js";

async function fetchJson(path, { signal } = {}) {
  const res = await fetch(apiUrl(path), {
    headers: { Accept: "application/json" },
    signal,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    throw new Error("not json");
  }
  return res.json();
}

export async function getBangumiCollection(status = "watching") {
  const data = await fetchJson(
    `/api/v1/bangumi/list?status=${encodeURIComponent(status)}`,
  );
  return {
    items: asList(data),
    counts: {
      watching: Number(data?.counts?.watching || 0),
      watched: Number(data?.counts?.watched || 0),
      wish: Number(data?.counts?.wish || 0),
    },
  };
}

export async function getBangumiList() {
  const { items } = await getBangumiCollection("watching");
  return items;
}

export async function getWallpaperGift({ apiOnly = false, signal } = {}) {
  const data = await fetchJson(
    apiOnly ? "/api/v1/wallpapers/draw?source=api" : "/api/v1/wallpapers/draw",
    { signal },
  );
  return data?.item || null;
}

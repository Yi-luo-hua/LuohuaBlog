/** API payloads may use { items: [...] } or a bare array; never pass through null/object. */
export function normalizeList(data, fallback = []) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return fallback;
}

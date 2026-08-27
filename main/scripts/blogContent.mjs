import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const FRONT_MATTER = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

const decodeScalar = (value = "") => {
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseList = (value = "") => {
  const trimmed = String(value).trim();
  if (!trimmed) return [];
  const content =
    trimmed.startsWith("[") && trimmed.endsWith("]")
      ? trimmed.slice(1, -1)
      : trimmed;
  return content
    .split(",")
    .map((item) => decodeScalar(item))
    .map((item) => item.trim())
    .filter(Boolean);
};

export const splitFrontMatter = (source) => {
  const normalized = String(source || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
  const match = normalized.match(FRONT_MATTER);
  return match
    ? { frontMatter: match[1], body: normalized.slice(match[0].length) }
    : { frontMatter: "", body: normalized };
};

export const parseFrontMatter = (source) => {
  const data = {};
  let activeList = "";

  for (const rawLine of String(source || "").split("\n")) {
    const listItem = rawLine.match(/^\s+-\s+(.+)$/);
    if (activeList && listItem) {
      data[activeList].push(decodeScalar(listItem[1]));
      continue;
    }

    const field = rawLine.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!field) {
      activeList = "";
      continue;
    }

    const [, key, rawValue] = field;
    if (!rawValue.trim()) {
      data[key] = [];
      activeList = key;
      continue;
    }

    activeList = "";
    data[key] = ["tags", "categories"].includes(key)
      ? parseList(rawValue)
      : decodeScalar(rawValue);
  }

  return data;
};

const stripMarkdown = (body) =>
  String(body || "")
    .replace(/\{%[\s\S]*?%\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/\\(?:text|mathrm|mathbf|boldsymbol|mathbb|mathcal)\{([^}]+)\}/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/\{([^}]+)\}/g, "$1")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/^[#>*_`~-]+/gm, "")
    .replace(/[|*`~]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeDate = (value, fallback) => {
  const text = String(value || fallback || "").trim();
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!match)
    return {
      iso: "1970-01-01",
      label: "未标注日期",
      parts: ["1970", "01", "01"],
    };
  const parts = [
    match[1],
    match[2].padStart(2, "0"),
    match[3].padStart(2, "0"),
  ];
  return {
    iso: parts.join("-"),
    label: `${parts[0]}年${Number(parts[1])}月${Number(parts[2])}日`,
    parts,
  };
};

const publicPostURL = (date, slug) =>
  `/blog/${date.parts.join("/")}/${encodeURIComponent(slug)}/`;

export const normalizeBlogAssetURL = (value) => {
  const assetURL = String(value || "").trim();
  if (!assetURL || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(assetURL)) {
    return assetURL;
  }
  if (assetURL === "/blog" || assetURL.startsWith("/blog/")) {
    return assetURL;
  }
  if (assetURL.startsWith("/")) return `/blog${assetURL}`;
  return `/blog/${assetURL.replace(/^\.\//, "")}`;
};

export const parseBlogPost = ({ source, filename, modifiedAt }) => {
  const { frontMatter, body } = splitFrontMatter(source);
  const meta = parseFrontMatter(frontMatter);
  if (String(meta.draft).toLowerCase() === "true") return null;

  const slug = path.basename(filename, path.extname(filename));
  const date = normalizeDate(meta.date, modifiedAt);
  const summary = String(meta.description || stripMarkdown(body))
    .slice(0, 150)
    .trim();
  const title = String(meta.title || slug).trim();

  return {
    id: `${date.iso}-${slug}`,
    title,
    slug,
    date: date.iso,
    dateLabel: date.label,
    updated: String(meta.updated || "").slice(0, 10),
    cover: normalizeBlogAssetURL(meta.cover),
    summary: summary || "这篇文章还没有摘要，点开看看正文吧。",
    tags: Array.isArray(meta.tags) ? meta.tags : parseList(meta.tags),
    categories: Array.isArray(meta.categories)
      ? meta.categories
      : parseList(meta.categories),
    sticky: Number(meta.sticky || 0),
    url: publicPostURL(date, slug),
  };
};

export const loadBlogPosts = async (postsDirectory) => {
  const entries = await readdir(postsDirectory, { withFileTypes: true });
  const posts = await Promise.all(
    entries
      .filter(
        (entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"),
      )
      .map(async (entry) => {
        const filePath = path.join(postsDirectory, entry.name);
        const source = await readFile(filePath, "utf8");
        return parseBlogPost({ source, filename: entry.name });
      }),
  );

  return posts
    .filter(Boolean)
    .sort((a, b) => b.sticky - a.sticky || b.date.localeCompare(a.date));
};

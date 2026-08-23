import { createInterface } from "node:readline";
import { readFile, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const serverInfo = { name: "yi-luo-hua-blog-publisher", version: "2.1.0" };
const publishTool = {
  name: "publish_blog_post",
  description:
    "Publish an Obsidian Markdown note to Yi-luo-hua's blog. Use dry_run=true first when the user asks to preview.",
  inputSchema: {
    type: "object",
    properties: {
      source_path: {
        type: "string",
        description:
          "Absolute path, or vault-relative path, of the Markdown note.",
      },
      title: {
        type: "string",
        description:
          "Optional title override. Front matter title or the first H1 is used by default.",
      },
      cover_url: {
        type: "string",
        description:
          "Optional cover override: public HTTPS URL, local vault image path, auto, or none.",
      },
      dry_run: {
        type: "boolean",
        default: false,
        description:
          "Validate and preview the generated post without committing to GitHub.",
      },
    },
    required: ["source_path"],
    additionalProperties: false,
  },
};

const writeMessage = (message) =>
  process.stdout.write(`${JSON.stringify(message)}\n`);

const resultText = (text, isError = false) => ({
  content: [{ type: "text", text }],
  ...(isError ? { isError: true } : {}),
});

const vaultRoot = path.resolve(
  process.env.OBSIDIAN_VAULT_ROOT || process.cwd(),
);
const githubOwner = String(
  process.env.BLOG_GITHUB_OWNER || "Yi-luo-hua",
).trim();
const githubRepo = String(process.env.BLOG_GITHUB_REPO || "taozhiyy").trim();
const githubBranch = String(process.env.BLOG_GITHUB_BRANCH || "master").trim();
const githubCli = String(process.env.GITHUB_CLI_PATH || "gh").trim();
const imageHostEndpoint = String(
  process.env.BLOG_IMAGE_HOST_ENDPOINT || "https://img.scdn.io/api/v1.php",
).trim();
const supportedImageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".bmp",
  ".tif",
  ".tiff",
]);

const resolveVaultNote = (sourcePath) => {
  const resolved = path.resolve(vaultRoot, sourcePath);
  const relative = path.relative(vaultRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("source_path 必须位于 OBSIDIAN_VAULT_ROOT 内。");
  }
  if (path.extname(resolved).toLowerCase() !== ".md") {
    throw new Error("只允许发布 Markdown（.md）文件。");
  }
  return resolved;
};

const trimYamlScalar = (value) => {
  const trimmed = String(value || "").trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const inferredTitle = (markdown, filePath) => {
  const frontMatter = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  const titleLine = frontMatter?.[1]
    ?.split(/\r?\n/)
    .find((line) => /^title\s*:/.test(line));
  if (titleLine) {
    const frontMatterTitle = trimYamlScalar(
      titleLine.replace(/^title\s*:\s*/, ""),
    );
    if (frontMatterTitle) return frontMatterTitle;
  }
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || path.basename(filePath, path.extname(filePath));
};

const splitFrontMatter = (markdown) => {
  const normalized = String(markdown || "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return { frontMatter: "", body: normalized };
  return {
    frontMatter: match[1],
    body: normalized.slice(match[0].length),
  };
};

const yamlScalar = (value) => {
  const text = String(value || "");
  if (!text) return '""';
  if (/^[\s]|[\s]$|[#"'\[\]{}:]/u.test(text)) return JSON.stringify(text);
  return text;
};

const formatDate = (date) => {
  const pad = (number) => String(number).padStart(2, "0");
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  ].join(" ");
};

const mergeFrontMatter = (rawFrontMatter, title, coverUrl, now) => {
  let dateValue = formatDate(now);
  let coverValue = String(coverUrl || "").trim();
  const otherLines = [];
  for (const line of rawFrontMatter.split("\n")) {
    const topLevel = line.match(/^([^\s:#][^:]*):\s*(.*)$/);
    if (!topLevel) {
      if (line) otherLines.push(line);
      continue;
    }
    const key = topLevel[1].trim().toLowerCase();
    const value = topLevel[2];
    if (key === "title") continue;
    if (key === "date") {
      if (trimYamlScalar(value)) dateValue = trimYamlScalar(value);
      continue;
    }
    if (key === "cover") {
      if (!coverValue) coverValue = trimYamlScalar(value);
      continue;
    }
    otherLines.push(line);
  }

  const lines = [`title: ${yamlScalar(title)}`, `date: ${dateValue}`];
  if (coverValue) lines.push(`cover: ${yamlScalar(coverValue)}`);
  lines.push(...otherLines);
  return `---\n${lines.join("\n")}\n---`;
};

const postStem = (title) =>
  Array.from(String(title || "").trim())
    .map((character) =>
      /^[\p{L}\p{N}]$/u.test(character) ? character.toLowerCase() : "-",
    )
    .join("")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const buildPost = (title, rawBody, coverUrl, now = new Date()) => {
  const { frontMatter, body } = splitFrontMatter(rawBody);
  const stem =
    postStem(title) || `post-${formatDate(now).replace(/[-: ]/g, "")}`;
  const markdownBody = body.replace(/^\n+/, "").trimEnd() || `# ${title}`;
  return {
    postPath: `blog/source/_posts/${stem}.md`,
    markdown: `${mergeFrontMatter(frontMatter, title, coverUrl, now)}\n\n${markdownBody}\n`,
  };
};

const frontMatterValue = (frontMatter, field) => {
  const pattern = new RegExp(`^${field}\\s*:\\s*(.*)$`, "im");
  return trimYamlScalar(frontMatter.match(pattern)?.[1] || "");
};

const isRemoteImage = (value) =>
  /^https?:\/\//i.test(String(value || "").trim());

const cleanMediaReference = (value) => {
  let cleaned = String(value || "").trim();
  if (cleaned.startsWith("<") && cleaned.endsWith(">"))
    cleaned = cleaned.slice(1, -1);
  if (cleaned.startsWith("[[") && cleaned.endsWith("]]"))
    cleaned = cleaned.slice(2, -2);
  cleaned = cleaned.split("|")[0].split("#")[0].trim();
  try {
    return decodeURIComponent(cleaned);
  } catch {
    return cleaned;
  }
};

const markdownImageReferences = (markdownBody) => {
  const references = [];
  const wikiPattern = /!\[\[([^\]]+)\]\]/g;
  const markdownPattern =
    /!\[([^\]]*)\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  for (const match of markdownBody.matchAll(wikiPattern)) {
    const [target, alias] = match[1].split("|");
    references.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      reference: cleanMediaReference(target),
      alt:
        alias && !/^\d+(?:x\d+)?$/.test(alias)
          ? alias
          : path.parse(target).name,
    });
  }
  for (const match of markdownBody.matchAll(markdownPattern)) {
    references.push({
      start: match.index,
      end: match.index + match[0].length,
      raw: match[0],
      reference: cleanMediaReference(match[2]),
      alt: match[1],
    });
  }
  return references.sort((left, right) => left.start - right.start);
};

const fileExists = async (filePath) => {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
};

const assertInsideVault = (filePath) => {
  const relative = path.relative(vaultRoot, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`图片必须位于 Obsidian Vault 内：${filePath}`);
  }
};

const findByBasename = async (basename) => {
  const matches = [];
  const queue = [vaultRoot];
  const skipped = new Set([".git", ".obsidian", ".trash", "node_modules"]);
  while (queue.length) {
    const directory = queue.shift();
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!skipped.has(entry.name))
          queue.push(path.join(directory, entry.name));
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase() === basename.toLowerCase()
      ) {
        matches.push(path.join(directory, entry.name));
      }
    }
  }
  if (matches.length > 1) {
    throw new Error(`图片文件名不唯一，请在笔记中写完整相对路径：${basename}`);
  }
  return matches[0];
};

const resolveVaultImage = async (reference, notePath) => {
  const cleaned = cleanMediaReference(reference);
  const candidates = path.isAbsolute(cleaned)
    ? [path.resolve(cleaned)]
    : [
        path.resolve(path.dirname(notePath), cleaned),
        path.resolve(vaultRoot, cleaned),
      ];
  for (const candidate of candidates) {
    assertInsideVault(candidate);
    if (await fileExists(candidate)) return candidate;
  }
  if (!cleaned.includes("/") && !cleaned.includes("\\")) {
    const found = await findByBasename(path.basename(cleaned));
    if (found) return found;
  }
  throw new Error(`找不到本地图片：${reference}`);
};

const prepareMedia = async (notePath, markdown, coverOverride) => {
  const { frontMatter, body } = splitFrontMatter(markdown);
  const bodyImages = markdownImageReferences(body);
  for (const image of bodyImages) {
    if (isRemoteImage(image.reference)) {
      image.remoteUrl = image.reference;
    } else {
      image.localPath = await resolveVaultImage(image.reference, notePath);
    }
  }

  const configuredCover = String(
    coverOverride || frontMatterValue(frontMatter, "cover"),
  ).trim();
  const coverKeyword = configuredCover.toLowerCase();
  let cover = { mode: "auto" };
  if (["none", "false", "off"].includes(coverKeyword)) {
    cover = { mode: "none" };
  } else if (configuredCover && coverKeyword !== "auto") {
    cover = isRemoteImage(configuredCover)
      ? { mode: "remote", remoteUrl: configuredCover }
      : {
          mode: "local",
          localPath: await resolveVaultImage(configuredCover, notePath),
          reference: cleanMediaReference(configuredCover),
        };
  }

  const localAssets = new Map();
  for (const image of bodyImages) {
    if (image.localPath) localAssets.set(image.localPath, image.reference);
  }
  if (cover.localPath) localAssets.set(cover.localPath, cover.reference);
  if (localAssets.size > 40)
    throw new Error("单篇文章最多自动上传 40 张本地图片。");

  return { frontMatter, body, bodyImages, cover, localAssets };
};

const mimeTypeFor = (filePath) => {
  const extension = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
  };
  if (!supportedImageExtensions.has(extension)) {
    throw new Error(`图床不支持该图片格式：${extension || filePath}`);
  }
  return mimeTypes[extension];
};

const uploadImage = async (filePath) => {
  const fileBytes = await readFile(filePath);
  const form = new FormData();
  form.append(
    "image",
    new Blob([fileBytes], { type: mimeTypeFor(filePath) }),
    path.basename(filePath),
  );
  form.append("outputFormat", "auto");
  const response = await fetch(imageHostEndpoint, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(90_000),
  });
  const payload = await response.json().catch(() => ({}));
  const remoteUrl = String(payload.url || payload.data?.url || "").trim();
  if (!response.ok || payload.success !== true || !isRemoteImage(remoteUrl)) {
    throw new Error(
      payload.message ||
        payload.error ||
        `图片上传失败，HTTP ${response.status}`,
    );
  }
  return remoteUrl;
};

const uploadLocalAssets = async (localAssets) => {
  const uploaded = new Map();
  let index = 0;
  for (const filePath of localAssets.keys()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 1100));
    uploaded.set(filePath, await uploadImage(filePath));
    index += 1;
  }
  return uploaded;
};

const rewriteBodyImages = (markdownBody, images, uploaded) => {
  let cursor = 0;
  let rewritten = "";
  for (const image of images) {
    rewritten += markdownBody.slice(cursor, image.start);
    const remoteUrl = image.remoteUrl || uploaded.get(image.localPath);
    rewritten += remoteUrl
      ? `![${image.alt || "image"}](${remoteUrl})`
      : image.raw;
    cursor = image.end;
  }
  return rewritten + markdownBody.slice(cursor);
};

const coverUrlFor = (media, uploaded) => {
  if (media.cover.mode === "none") return "";
  if (media.cover.remoteUrl) return media.cover.remoteUrl;
  if (media.cover.localPath) return uploaded.get(media.cover.localPath) || "";
  const firstImage = media.bodyImages[0];
  return firstImage?.remoteUrl || uploaded.get(firstImage?.localPath) || "";
};

const rebuildMarkdown = (frontMatter, body) =>
  frontMatter ? `---\n${frontMatter}\n---\n${body}` : body;

const runGitHub = (args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(githubCli, args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(
        new Error(
          error.code === "ENOENT"
            ? "找不到 GitHub CLI，请确认 gh 已安装并登录。"
            : error.message,
        ),
      );
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new Error(
          stderr.trim() || stdout.trim() || `GitHub CLI 退出码 ${code}`,
        ),
      );
    });
    child.stdin.end(input || "");
  });

const encodedContentPath = (postPath) =>
  postPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

const publishToGitHub = async (postPath, title, markdown) => {
  const endpoint = `repos/${githubOwner}/${githubRepo}/contents/${encodedContentPath(postPath)}`;
  const payload = {
    message: `feat: publish ${title}`,
    content: Buffer.from(markdown, "utf8").toString("base64"),
    branch: githubBranch,
  };
  const output = await runGitHub(
    ["api", "--method", "PUT", endpoint, "--input", "-"],
    JSON.stringify(payload),
  );
  const response = JSON.parse(output);
  return {
    path: response.content?.path || postPath,
    commitSha: response.commit?.sha || "",
  };
};

const publishNote = async (args) => {
  const filePath = resolveVaultNote(String(args.source_path || ""));
  const body = await readFile(filePath, "utf8");
  const title = String(args.title || inferredTitle(body, filePath)).trim();
  if (!title || Array.from(title).length > 120) {
    throw new Error("文章标题不能为空，且不能超过 120 个字符。");
  }
  if (!body.trim() || Buffer.byteLength(body, "utf8") > 200_000) {
    throw new Error("文章正文不能为空，且不能超过 200000 字节。");
  }
  const media = await prepareMedia(
    filePath,
    body,
    String(args.cover_url || "").trim(),
  );
  const previewPost = buildPost(title, body, "");

  if (args.dry_run) {
    await runGitHub(["auth", "status", "--hostname", "github.com"]);
    const coverPlan =
      media.cover.mode === "none"
        ? "不设置封面"
        : media.cover.mode === "local"
          ? `上传本地封面：${media.cover.reference}`
          : media.cover.mode === "remote"
            ? "使用现有远程封面"
            : media.bodyImages.length
              ? "自动使用正文第一张图片作为封面"
              : "正文没有图片，不设置封面";
    return resultText(
      [
        `预检通过：${title}`,
        `目标：${previewPost.postPath}`,
        `仓库：${githubOwner}/${githubRepo} (${githubBranch})`,
        `本地图片：${media.localAssets.size} 张`,
        `封面：${coverPlan}`,
        "尚未提交到 GitHub。",
      ].join("\n"),
    );
  }

  await runGitHub(["auth", "status", "--hostname", "github.com"]);
  const uploaded = await uploadLocalAssets(media.localAssets);
  const rewrittenBody = rewriteBodyImages(
    media.body,
    media.bodyImages,
    uploaded,
  );
  const rewrittenMarkdown = rebuildMarkdown(media.frontMatter, rewrittenBody);
  const { postPath, markdown } = buildPost(
    title,
    rewrittenMarkdown,
    coverUrlFor(media, uploaded),
  );
  const published = await publishToGitHub(postPath, title, markdown);
  const repoUrl = `https://github.com/${githubOwner}/${githubRepo}/blob/${githubBranch}/${encodedContentPath(published.path)}`;
  return resultText(
    [
      `发布成功：${title}`,
      `文件：${published.path}`,
      `分支：${githubBranch}`,
      published.commitSha ? `Commit：${published.commitSha}` : "",
      uploaded.size ? `已上传图片：${uploaded.size} 张` : "",
      `GitHub：${repoUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
};

const handleRequest = async (message) => {
  const { id, method, params = {} } = message;
  if (
    method === "notifications/initialized" ||
    method?.startsWith("notifications/")
  )
    return;

  try {
    if (method === "initialize") {
      writeMessage({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params.protocolVersion || "2025-03-26",
          capabilities: { tools: {} },
          serverInfo,
        },
      });
      return;
    }
    if (method === "ping") {
      writeMessage({ jsonrpc: "2.0", id, result: {} });
      return;
    }
    if (method === "tools/list") {
      writeMessage({ jsonrpc: "2.0", id, result: { tools: [publishTool] } });
      return;
    }
    if (method === "tools/call") {
      if (params.name !== publishTool.name)
        throw new Error(`未知工具：${params.name}`);
      const result = await publishNote(params.arguments || {});
      writeMessage({ jsonrpc: "2.0", id, result });
      return;
    }
    writeMessage({
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not found: ${method}` },
    });
  } catch (error) {
    if (method === "tools/call") {
      writeMessage({
        jsonrpc: "2.0",
        id,
        result: resultText(error.message, true),
      });
      return;
    }
    writeMessage({
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error.message || "Unknown error" },
    });
  }
};

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
lines.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    void handleRequest(JSON.parse(trimmed));
  } catch (error) {
    writeMessage({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: error.message || "Parse error" },
    });
  }
});

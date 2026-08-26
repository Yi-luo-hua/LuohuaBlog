import { createInterface } from "node:readline";
import { readFile, readdir, stat, writeFile, mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const serverInfo = { name: "yi-luo-hua-blog-publisher", version: "2.3.0" };
const publishTool = {
  name: "publish_blog_post",
  description:
    "Publish or update an Obsidian Markdown note to Yi-luo-hua's blog with automatic GitHub commit and Azure production deployment. Use dry_run=true first when the user asks to preview.",
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
      deploy: {
        type: "boolean",
        default: true,
        description:
          "Automatically build and push-deploy the blog to Azure production server after committing to GitHub (defaults to true).",
      },
      dry_run: {
        type: "boolean",
        default: false,
        description:
          "Validate and preview the generated post without committing to GitHub or deploying.",
      },
    },
    required: ["source_path"],
    additionalProperties: false,
  },
};

const deleteTool = {
  name: "delete_blog_post",
  description:
    "Delete a published blog post from GitHub repository and remove it from Azure production server. Use dry_run=true first when the user asks to preview.",
  inputSchema: {
    type: "object",
    properties: {
      post_identifier: {
        type: "string",
        description:
          "Post title, filename (e.g. 'my-post.md'), or path in blog/source/_posts/.",
      },
      deploy: {
        type: "boolean",
        default: true,
        description:
          "Automatically build and remove the post from Azure production server (defaults to true).",
      },
      dry_run: {
        type: "boolean",
        default: false,
        description:
          "Validate and preview the post to be deleted without committing to GitHub or deploying.",
      },
    },
    required: ["post_identifier"],
    additionalProperties: false,
  },
};

const writeMessage = (message) =>
  process.stdout.write(`${JSON.stringify(message)}\n`);

const resultText = (text, isError = false) => ({
  content: [{ type: "text", text }],
  ...(isError ? { isError: true } : {}),
});

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const vaultRoot = path.resolve(
  process.env.OBSIDIAN_VAULT_ROOT || process.cwd(),
);
const githubOwner = String(
  process.env.BLOG_GITHUB_OWNER || "Yi-luo-hua",
).trim();
const githubRepo = String(process.env.BLOG_GITHUB_REPO || "LuohuaBlog").trim();
const githubBranch = String(process.env.BLOG_GITHUB_BRANCH || "master").trim();
const githubCli = String(process.env.GITHUB_CLI_PATH || "gh").trim();

// Where committed images land inside the repository, and the URL they get
// once Hexo copies source/ into public/. Hexo has post_asset_folder off and an
// empty skip_render, so anything here that it cannot render is copied verbatim.
const blogImageDir = "blog/source/images";
const blogImagePrefix = "/blog/images";
const maxImageBytes = 10 * 1024 * 1024;
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
    throw new Error(`博客不支持该图片格式：${extension || filePath}`);
  }
  return mimeTypes[extension];
};

// A published image's filename carries a hash of its own bytes. That makes the
// path deterministic, so republishing the same note is a no-op instead of
// piling up duplicates, and it makes the file safe to cache forever.
const plannedImage = async (filePath) => {
  const bytes = await readFile(filePath);
  if (bytes.byteLength > maxImageBytes) {
    throw new Error(
      `图片超过 ${Math.round(maxImageBytes / 1048576)} MB：${path.basename(filePath)}`,
    );
  }
  mimeTypeFor(filePath); // rejects formats the blog will not serve
  const digest = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
  const extension = path.extname(filePath).toLowerCase();
  const stem = path
    .basename(filePath, path.extname(filePath))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const now = new Date();
  const folder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const name = `${digest}${stem ? `-${stem}` : ""}${extension}`;
  return {
    bytes,
    repoPath: `${blogImageDir}/${folder}/${name}`,
    publicUrl: `${blogImagePrefix}/${folder}/${name}`,
  };
};

const planLocalAssets = async (localAssets) => {
  const planned = new Map();
  for (const filePath of localAssets.keys()) {
    planned.set(filePath, await plannedImage(filePath));
  }
  return planned;
};

const repoFileExists = async (repoPath) => {
  try {
    await runGitHub([
      "api",
      `repos/${githubOwner}/${githubRepo}/contents/${encodedContentPath(repoPath)}?ref=${encodeURIComponent(githubBranch)}`,
    ]);
    return true;
  } catch {
    return false;
  }
};

// Commit each image into the repository instead of posting it to a third-party
// image host. The host was outside the site's control: it could expire, rewrite
// or lose the file, and nothing on this side would know. In the repository the
// image is versioned with the post that uses it, ships with the ordinary blog
// deploy, and is restored by a plain checkout.
const commitLocalAssets = async (planned) => {
  const urls = new Map();
  let committed = 0;
  let reused = 0;
  for (const [filePath, plan] of planned) {
    urls.set(filePath, plan.publicUrl);
    if (await repoFileExists(plan.repoPath)) {
      // Same bytes, same name — already published by an earlier run.
      reused += 1;
      continue;
    }
    await runGitHub(
      [
        "api",
        "--method",
        "PUT",
        `repos/${githubOwner}/${githubRepo}/contents/${encodedContentPath(plan.repoPath)}`,
        "--input",
        "-",
      ],
      JSON.stringify({
        message: `feat: add blog image ${path.basename(plan.repoPath)}`,
        content: Buffer.from(plan.bytes).toString("base64"),
        branch: githubBranch,
      }),
    );
    committed += 1;
  }
  return { urls, committed, reused };
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

const getFileShaFromGitHub = async (repoPath) => {
  try {
    const output = await runGitHub([
      "api",
      `repos/${githubOwner}/${githubRepo}/contents/${encodedContentPath(repoPath)}?ref=${encodeURIComponent(githubBranch)}`,
    ]);
    const parsed = JSON.parse(output);
    return parsed.sha || null;
  } catch {
    return null;
  }
};

const publishToGitHub = async (postPath, title, markdown) => {
  const existingSha = await getFileShaFromGitHub(postPath);
  const endpoint = `repos/${githubOwner}/${githubRepo}/contents/${encodedContentPath(postPath)}`;
  const payload = {
    message: existingSha ? `feat: update ${title}` : `feat: publish ${title}`,
    content: Buffer.from(markdown, "utf8").toString("base64"),
    branch: githubBranch,
    ...(existingSha ? { sha: existingSha } : {}),
  };
  const output = await runGitHub(
    ["api", "--method", "PUT", endpoint, "--input", "-"],
    JSON.stringify(payload),
  );
  const response = JSON.parse(output);
  return {
    path: response.content?.path || postPath,
    commitSha: response.commit?.sha || "",
    isUpdate: Boolean(existingSha),
  };
};

const syncGitPull = async () => {
  return new Promise((resolve) => {
    const child = spawn("git", ["pull", "--ff-only"], {
      cwd: repoRoot,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });
};

const resolvePublishedPost = async (identifier) => {
  const raw = String(identifier || "").trim();
  if (!raw) throw new Error("请指定要删除的文章标题或文件名。");

  const candidates = [];
  if (raw.startsWith("blog/source/_posts/")) {
    candidates.push(raw);
  } else {
    const basename = raw.endsWith(".md") ? raw : `${raw}.md`;
    candidates.push(`blog/source/_posts/${basename}`);
    const stem = postStem(raw.replace(/\.md$/i, ""));
    if (stem && `${stem}.md` !== basename) {
      candidates.push(`blog/source/_posts/${stem}.md`);
    }
  }

  for (const candidate of candidates) {
    const sha = await getFileShaFromGitHub(candidate);
    if (sha) return { repoPath: candidate, sha };
  }

  // Look up within the posts directory on GitHub
  try {
    const output = await runGitHub([
      "api",
      `repos/${githubOwner}/${githubRepo}/contents/blog/source/_posts?ref=${encodeURIComponent(githubBranch)}`,
    ]);
    const items = JSON.parse(output);
    if (Array.isArray(items)) {
      const exactMatches = items.filter(
        (it) =>
          it.name.toLowerCase() === raw.toLowerCase() ||
          it.name.toLowerCase() === `${raw.toLowerCase()}.md`,
      );
      if (exactMatches.length === 1) {
        return { repoPath: exactMatches[0].path, sha: exactMatches[0].sha };
      }
      if (exactMatches.length > 1) {
        throw new Error(
          `匹配到多个同名候选文章：${exactMatches.map((m) => m.name).join(", ")}，请指定精确路径。`,
        );
      }

      // Exact title match check from local or remote files
      const stemMatches = items.filter(
        (it) => postStem(it.name.replace(/\.md$/i, "")) === postStem(raw),
      );
      if (stemMatches.length === 1) {
        return { repoPath: stemMatches[0].path, sha: stemMatches[0].sha };
      }
      if (stemMatches.length > 1) {
        throw new Error(
          `匹配到多个同标题候选文章：${stemMatches.map((m) => m.name).join(", ")}，请指定精确文件名。`,
        );
      }
    }
  } catch (err) {
    if (err.message && err.message.includes("候选文章")) throw err;
  }

  throw new Error(`在仓库中找不到匹配的文章：${raw}`);
};

const deleteNote = async (args) => {
  await runGitHub(["auth", "status", "--hostname", "github.com"]);
  const post = await resolvePublishedPost(args.post_identifier);
  const shouldDeploy = args.deploy !== false;

  if (args.dry_run) {
    return resultText(
      [
        "删除预检通过",
        `目标文件：${post.repoPath}`,
        `仓库：${githubOwner}/${githubRepo} (${githubBranch})`,
        `自动下架：${shouldDeploy ? "正式删除时将自动重新编译 Hexo 并从 Azure 生产服务器下架" : "仅从 GitHub 仓库删除"}`,
        "尚未执行删除。",
      ].join("\n"),
    );
  }

  const endpoint = `repos/${githubOwner}/${githubRepo}/contents/${encodedContentPath(post.repoPath)}`;
  const payload = {
    message: `chore: delete post ${path.basename(post.repoPath, ".md")}`,
    sha: post.sha,
    branch: githubBranch,
  };
  const output = await runGitHub(
    ["api", "--method", "DELETE", endpoint, "--input", "-"],
    JSON.stringify(payload),
  );
  const response = JSON.parse(output);
  const commitSha = response.commit?.sha || "";

  // Delete local file with directory boundary containment check
  const postsDir = path.resolve(repoRoot, "blog/source/_posts");
  const localPostPath = path.resolve(repoRoot, post.repoPath);
  const relative = path.relative(postsDir, localPostPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`非法文章路径：${post.repoPath}`);
  }
  await rm(localPostPath, { force: true });

  let deploySuccess = false;
  let deployErrorMsg = "";
  if (shouldDeploy) {
    try {
      await syncGitPull();
      await runDeployBlog();
      deploySuccess = true;
    } catch (error) {
      deployErrorMsg = error.message;
    }
  }

  const lines = [
    deploySuccess ? "文章删除并下架成功" : "文章已从 GitHub 仓库删除",
    `文件：${post.repoPath}`,
    `分支：${githubBranch}`,
    commitSha ? `Commit：${commitSha}` : "",
  ];

  if (deploySuccess) {
    lines.push(
      "",
      "🗑️ 已自动重新执行 Hexo 编译并从 Azure 生产服务器彻底移除！",
      "线上访问：https://yiluohua.top/blog/",
    );
  } else if (shouldDeploy) {
    lines.push(
      "",
      `⚠️ 生产服务器下架未能自动完成：${deployErrorMsg}`,
      "文章已从 GitHub 仓库移除，您可手动执行 deploy/deploy-azure.sh blog 完成线上同步。",
    );
  }

  return resultText(lines.filter(Boolean).join("\n"));
};

const findBash = async () => {
  const customBash = process.env.GIT_BASH_PATH || process.env.BASH_PATH;
  if (customBash && (await fileExists(customBash))) return customBash;
  const standardGitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
  if (await fileExists(standardGitBash)) return standardGitBash;
  return "bash";
};

const syncLocalFilesystem = async (postPath, markdown, planned) => {
  await syncGitPull();
  const localPostPath = path.resolve(repoRoot, postPath);
  await mkdir(path.dirname(localPostPath), { recursive: true });
  await writeFile(localPostPath, markdown, "utf8");

  for (const [sourcePath, plan] of planned) {
    const localImgPath = path.resolve(repoRoot, plan.repoPath);
    await mkdir(path.dirname(localImgPath), { recursive: true });
    await writeFile(localImgPath, plan.bytes);
  }
};

const runDeployBlog = async () => {
  const bashPath = await findBash();
  return new Promise((resolve, reject) => {
    const child = spawn(bashPath, ["-c", "deploy/deploy-azure.sh blog"], {
      cwd: repoRoot,
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
      reject(new Error(`无法启动部署脚本：${error.message}`));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(
        new Error(
          stderr.trim() || stdout.trim() || `部署脚本退出码 ${code}`,
        ),
      );
    });
  });
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
  const shouldDeploy = args.deploy !== false;

  if (args.dry_run) {
    await runGitHub(["auth", "status", "--hostname", "github.com"]);
    const plannedPreview = await planLocalAssets(media.localAssets);
    const coverPlan =
      media.cover.mode === "none"
        ? "不设置封面"
        : media.cover.mode === "local"
          ? `提交本地封面：${media.cover.reference}`
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
        ...[...plannedPreview.values()].map((plan) => `  → ${plan.publicUrl}`),
        `封面：${coverPlan}`,
        `自动部署：${shouldDeploy ? "正式发布时将自动编译并推送至 Azure 生产服务器" : "跳过部署 (仅提交 GitHub)"}`,
        "尚未提交到 GitHub 与服务器。",
      ].join("\n"),
    );
  }

  await runGitHub(["auth", "status", "--hostname", "github.com"]);
  const planned = await planLocalAssets(media.localAssets);
  const { urls: uploaded, committed, reused } = await commitLocalAssets(planned);
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

  let deploySuccess = false;
  let deployErrorMsg = "";

  if (shouldDeploy) {
    try {
      await syncLocalFilesystem(postPath, markdown, planned);
      await runDeployBlog();
      deploySuccess = true;
    } catch (error) {
      deployErrorMsg = error.message;
    }
  }

  const lines = [
    deploySuccess
      ? `发布并上线成功：${title}`
      : `GitHub 提交成功：${title}`,
    `文件：${published.path}`,
    `分支：${githubBranch}`,
    published.commitSha ? `Commit：${published.commitSha}` : "",
    committed ? `已提交图片：${committed} 张` : "",
    reused ? `复用已有图片：${reused} 张` : "",
    `GitHub：${repoUrl}`,
  ];

  if (deploySuccess) {
    lines.push(
      "",
      "🚀 已自动完成 Hexo 编译并成功推送至生产服务器！",
      "线上访问：https://yiluohua.top/blog/",
    );
  } else if (shouldDeploy) {
    lines.push(
      "",
      `⚠️ 自动部署未能完成：${deployErrorMsg}`,
      "文章已安全保存在 GitHub，您可以稍后手动执行：deploy/deploy-azure.sh blog",
    );
  } else {
    lines.push(
      "",
      "（已跳过自动部署，仅提交到 GitHub 仓库）",
      "如需上线请在本地执行：deploy/deploy-azure.sh blog",
    );
  }

  return resultText(lines.filter(Boolean).join("\n"));
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
      writeMessage({
        jsonrpc: "2.0",
        id,
        result: { tools: [publishTool, deleteTool] },
      });
      return;
    }
    if (method === "tools/call") {
      if (params.name === publishTool.name) {
        const result = await publishNote(params.arguments || {});
        writeMessage({ jsonrpc: "2.0", id, result });
        return;
      }
      if (params.name === deleteTool.name) {
        const result = await deleteNote(params.arguments || {});
        writeMessage({ jsonrpc: "2.0", id, result });
        return;
      }
      throw new Error(`未知工具：${params.name}`);
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

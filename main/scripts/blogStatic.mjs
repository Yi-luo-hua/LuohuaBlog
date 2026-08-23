import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

const BLOG_PREFIX = "/blog";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".otf", "font/otf"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml; charset=utf-8"],
]);

const isInside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
};

export const resolveBlogStaticPath = (publicDirectory, requestURL) => {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(requestURL, "http://localhost").pathname,
    );
  } catch {
    return null;
  }

  if (pathname !== BLOG_PREFIX && !pathname.startsWith(`${BLOG_PREFIX}/`)) {
    return undefined;
  }

  let relativePath = pathname.slice(BLOG_PREFIX.length).replace(/^\/+/, "");
  if (!relativePath || pathname.endsWith("/")) {
    relativePath = path.join(relativePath, "index.html");
  }

  const root = path.resolve(publicDirectory);
  const candidate = path.resolve(root, relativePath);
  return isInside(root, candidate) ? candidate : null;
};

const findStaticFile = async (candidate) => {
  try {
    const details = await stat(candidate);
    if (details.isFile()) return candidate;
    if (!details.isDirectory()) return null;
    const indexFile = path.join(candidate, "index.html");
    return (await stat(indexFile)).isFile() ? indexFile : null;
  } catch {
    return null;
  }
};

export const blogStaticMiddleware =
  (publicDirectory) => async (req, res, next) => {
    const candidate = resolveBlogStaticPath(publicDirectory, req.url || "/");
    if (candidate === undefined) return next();
    if (candidate === null) {
      res.statusCode = 400;
      res.end("Bad blog path");
      return;
    }

    const filePath = await findStaticFile(candidate);
    if (!filePath) {
      res.statusCode = 404;
      res.end("Blog page not found");
      return;
    }

    res.statusCode = 200;
    res.setHeader(
      "Content-Type",
      contentTypes.get(path.extname(filePath).toLowerCase()) ||
        "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-cache");
    if (req.method === "HEAD") {
      res.end();
      return;
    }

    const stream = createReadStream(filePath);
    stream.on("error", next);
    stream.pipe(res);
  };

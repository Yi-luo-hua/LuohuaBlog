import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadBlogPosts } from "./scripts/blogContent.mjs";
import { blogStaticMiddleware } from "./scripts/blogStatic.mjs";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const postsDirectory = path.resolve(currentDirectory, "../blog/source/_posts");
const blogPublicDirectory = path.resolve(currentDirectory, "../blog/public");
const virtualBlogPosts = "virtual:blog-posts";
const resolvedVirtualBlogPosts = `\0${virtualBlogPosts}`;

const blogContentPlugin = () => ({
  name: "yi-luo-hua-blog-content",
  resolveId(id) {
    return id === virtualBlogPosts ? resolvedVirtualBlogPosts : null;
  },
  async load(id) {
    if (id !== resolvedVirtualBlogPosts) return null;
    const posts = await loadBlogPosts(postsDirectory);
    return `export const blogPosts = ${JSON.stringify(posts)};`;
  },
  configureServer(server) {
    server.middlewares.use(blogStaticMiddleware(blogPublicDirectory));
    server.watcher.add(postsDirectory);
    const reloadBlog = (file) => {
      if (!file.startsWith(postsDirectory) || !file.endsWith(".md")) return;
      const module = server.moduleGraph.getModuleById(resolvedVirtualBlogPosts);
      if (module) server.moduleGraph.invalidateModule(module);
      server.ws.send({ type: "full-reload" });
    };
    server.watcher.on("add", reloadBlog);
    server.watcher.on("change", reloadBlog);
    server.watcher.on("unlink", reloadBlog);
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), blogContentPlugin()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
      // Media used to be proxied straight to the template author's Tencent COS
      // bucket. Production now serves /cos/ from its own disk, so dev borrows it
      // from production instead — same files, and no third-party bucket left in
      // the loop. Point VITE_COS_ORIGIN somewhere else to override.
      "/cos": {
        target: process.env.VITE_COS_ORIGIN || "http://65.52.160.147",
        changeOrigin: true,
      },
    },
  },
});

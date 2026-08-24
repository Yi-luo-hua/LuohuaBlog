import { useMemo, useState } from "react";
import {
  FiArrowUpRight,
  FiBookOpen,
  FiCalendar,
  FiFeather,
  FiFolder,
  FiGithub,
  FiSearch,
  FiTag,
} from "react-icons/fi";
import { blogPosts } from "virtual:blog-posts";

const githubProfile = "https://github.com/Yi-luo-hua";

const uniqueValues = (posts, field) => [
  ...new Set(posts.flatMap((post) => post[field] || []).filter(Boolean)),
];

const PostMeta = ({ post }) => (
  <div className="blog-post-meta">
    <span>
      <FiCalendar aria-hidden="true" />
      <time dateTime={post.date}>{post.dateLabel}</time>
    </span>
    {post.categories[0] && (
      <span>
        <FiFolder aria-hidden="true" />
        {post.categories[0]}
      </span>
    )}
  </div>
);

const PostTags = ({ tags }) => {
  if (!tags.length) return null;
  return (
    <div className="blog-post-tags" aria-label="文章标签">
      {tags.slice(0, 4).map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
};

const LeadPost = ({ post }) => (
  <a className="blog-lead-card" href={post.url}>
    <div className="blog-lead-cover">
      {post.cover ? (
        <img src={post.cover} alt="" loading="eager" />
      ) : (
        <span className="blog-cover-monogram" aria-hidden="true">
          YL
        </span>
      )}
      <span className="blog-lead-index">01</span>
    </div>
    <div className="blog-lead-copy">
      <span className="blog-pin">置顶文章</span>
      <h2>{post.title}</h2>
      <PostMeta post={post} />
      <p>{post.summary}</p>
      <PostTags tags={post.tags} />
      <span className="blog-read-link">
        阅读全文 <FiArrowUpRight aria-hidden="true" />
      </span>
    </div>
  </a>
);

const PostCard = ({ post, index }) => (
  <a
    className="blog-post-card"
    href={post.url}
    style={{ "--blog-card-index": index }}
  >
    <div className={`blog-card-cover${post.cover ? " has-image" : ""}`}>
      {post.cover ? (
        <img src={post.cover} alt="" loading="lazy" />
      ) : (
        <>
          <span className="blog-cover-number" aria-hidden="true">
            {String(index + 2).padStart(2, "0")}
          </span>
          <FiFeather aria-hidden="true" />
        </>
      )}
    </div>
    <div className="blog-card-copy">
      <PostMeta post={post} />
      <h2>{post.title}</h2>
      <p>{post.summary}</p>
      <PostTags tags={post.tags} />
      <span className="blog-read-link">
        打开文章 <FiArrowUpRight aria-hidden="true" />
      </span>
    </div>
  </a>
);

const BlogSidebar = ({ posts, categories, tags }) => (
  <aside className="blog-sidebar" aria-label="博客信息">
    <section className="blog-profile-card">
      <div className="blog-avatar-frame">
        <img src="/github-avatar.png" alt="伊洛华的头像" />
      </div>
      <p className="blog-profile-kicker">EDITOR / OWNER</p>
      <h2>伊洛华</h2>
      <p>把学习、技术和喜欢的事，一篇一篇留在这里。</p>
      <div className="blog-profile-stats">
        <span>
          <strong>{posts.length}</strong>
          文章
        </span>
        <span>
          <strong>{tags.length}</strong>
          标签
        </span>
        <span>
          <strong>{categories.length}</strong>
          分类
        </span>
      </div>
      <a href={githubProfile} target="_blank" rel="noreferrer">
        <FiGithub aria-hidden="true" />
        GitHub 主页
      </a>
    </section>

    <section className="blog-side-card">
      <div className="blog-side-title">
        <span>最近更新</span>
        <FiBookOpen aria-hidden="true" />
      </div>
      <div className="blog-recent-list">
        {posts.slice(0, 5).map((post, index) => (
          <a href={post.url} key={post.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>{post.title}</strong>
              <time dateTime={post.date}>{post.date}</time>
            </div>
          </a>
        ))}
      </div>
    </section>

    <section className="blog-side-card blog-category-card">
      <div className="blog-side-title">
        <span>写作分类</span>
        <FiFolder aria-hidden="true" />
      </div>
      <div>
        {categories.slice(0, 8).map((category) => (
          <span key={category}>{category}</span>
        ))}
      </div>
    </section>
  </aside>
);

const MomentsPage = () => {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState("全部");
  const tags = useMemo(() => uniqueValues(blogPosts, "tags"), []);
  const categories = useMemo(() => uniqueValues(blogPosts, "categories"), []);

  const filteredPosts = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return blogPosts.filter((post) => {
      const tagMatches = activeTag === "全部" || post.tags.includes(activeTag);
      const text = [post.title, post.summary, ...post.tags, ...post.categories]
        .join(" ")
        .toLowerCase();
      return tagMatches && (!needle || text.includes(needle));
    });
  }, [activeTag, query]);

  const [leadPost, ...remainingPosts] = filteredPosts;

  return (
    <main className="blog-showcase-page">
      <div className="blog-paper-grid" aria-hidden="true" />
      <header className="blog-showcase-hero">
        <div>
          <p className="blog-eyebrow">
            <span /> YI-LUO-HUA / WRITING ROOM
          </p>
          <h1>
            文章与<span>札记</span>
          </h1>
        </div>
        <div className="blog-hero-stamp" aria-hidden="true">
          <strong>{blogPosts.length}</strong>
          <span>POSTS</span>
        </div>
      </header>

      <section className="blog-filter-bar" aria-label="筛选文章">
        <label className="blog-search-box">
          <FiSearch aria-hidden="true" />
          <span className="sr-only">搜索文章</span>
          <input
            type="search"
            value={query}
            placeholder="搜索标题、摘要或标签"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="blog-filter-tags">
          {["全部", ...tags.slice(0, 7)].map((tag) => (
            <button
              key={tag}
              type="button"
              className={activeTag === tag ? "active" : ""}
              onClick={() => setActiveTag(tag)}
            >
              <FiTag aria-hidden="true" />
              {tag}
            </button>
          ))}
        </div>
      </section>

      <div className="blog-showcase-layout">
        <section className="blog-post-feed" aria-live="polite">
          {leadPost ? (
            <>
              <LeadPost post={leadPost} />
              <div className="blog-post-grid">
                {remainingPosts.map((post, index) => (
                  <PostCard post={post} index={index} key={post.id} />
                ))}
              </div>
            </>
          ) : (
            <div className="blog-empty-state">
              <FiFeather aria-hidden="true" />
              <h2>没有找到对应文章</h2>
              <p>换个关键词，或者选择“全部”再看看。</p>
            </div>
          )}
        </section>

        <BlogSidebar posts={blogPosts} categories={categories} tags={tags} />
      </div>
    </main>
  );
};

export default MomentsPage;

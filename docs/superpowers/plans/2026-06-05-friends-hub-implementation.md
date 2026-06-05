# Friends Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `/friends` page in `main`, expose it from the main navbar, and remove old friend-link entry points from `build` and `blog`.

**Architecture:** Keep the main-site routing pattern consistent with existing product subpages by adding a dedicated `FriendsPage` and extending navbar route/theme handling. Reuse the existing guestbook API path for the application message area, but present it through a new page-specific UI so the section feels native to the Friends hub. Remove legacy friend-link routes and menu items from `build` and `blog` instead of redirecting or preserving fallback pages.

**Tech Stack:** React, React Router, Tailwind utility classes, TypeScript for `build`, Hexo Butterfly config and content files, git.

---

### Task 1: Add the main-site Friends route and navigation entry

**Files:**
- Create: `main/src/pages/FriendsPage.jsx`
- Modify: `main/src/App.jsx`
- Modify: `main/src/components/Navbar.jsx`

- [ ] **Step 1: Add the failing route import and route entry**

```jsx
import FriendsPage from "./pages/FriendsPage";

<Route path="friends" element={<FriendsPage />} />
```

- [ ] **Step 2: Update navbar link definitions and active-route detection**

```jsx
const navLinks = [
  { label: "HOME", to: "/", end: true },
  { label: "Gallery", to: "/gallery", end: true },
  { label: "Bili Hub", to: "/bili", end: true },
  { label: "AI 娴侀噺", to: "/ai-traffic", end: true },
  { label: "Friends", to: "/friends", end: true },
];
```

```jsx
if (pathname === "/friends" || pathname.startsWith("/friends/")) return "friends";
```

- [ ] **Step 3: Extend navbar subpage/light-theme handling for Friends**

```jsx
const isFriendsPage =
  pathname === "/friends" || pathname.startsWith("/friends/");
const isSubPage =
  isBiliPage || isAiTrafficPage || isGuestbookPage || isGalleryPage || isFriendsPage;
```

```jsx
"floating-nav-friends"
```

- [ ] **Step 4: Run a focused build for `main`**

Run: `npm run build`

Workdir: `D:\taozhiyy-monorepo\main`

Expected: build completes successfully and includes the new `/friends` route without React compile errors.

- [ ] **Step 5: Commit**

```bash
git add main/src/App.jsx main/src/components/Navbar.jsx main/src/pages/FriendsPage.jsx
git commit -m "feat: add main friends hub route"
```

### Task 2: Build the new Friends page and application message area

**Files:**
- Create: `main/src/components/FriendsApplicationBoard.jsx`
- Modify: `main/src/pages/FriendsPage.jsx`
- Modify: `main/src/services/guestbookApi.js` (only if a page-specific submit helper is needed)

- [ ] **Step 1: Create a dedicated application board component that reuses the guestbook API**

```jsx
import { useEffect, useState } from "react";
import { getGuestbook, postGuestbook } from "../services/guestbookApi";

const FriendsApplicationBoard = () => {
  const [entries, setEntries] = useState([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getGuestbook(24).then((items) => {
      setEntries(items);
      setLoading(false);
    });
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setNotice("");
    const row = await postGuestbook({
      name: name.trim() || "friend-signal",
      content,
    });
    setEntries((prev) => [row, ...prev].slice(0, 24));
    setContent("");
    setNotice(row.offline ? "Saved locally while the API is offline." : "Application sent.");
    setSubmitting(false);
  };
};
```

- [ ] **Step 2: Implement the page layout for site info, application rules, and message board**

```jsx
const siteFacts = [
  { label: "Site Name", value: "桃之夭夭" },
  { label: "URL", value: "https://bistutzyy.github.io" },
  { label: "Description", value: "记录热爱、创作与长期主义的个人空间。" },
  { label: "Avatar", value: "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/1.png" },
];
```

```jsx
<section className="relative overflow-hidden bg-[#F8F5EE] text-[#1A1D1A]">
  <div className="mx-auto max-w-6xl px-4 pb-24 pt-28 md:px-6 md:pt-32">
    <header className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.34em] text-[#6FAE9B]">Signal Exchange Node</p>
      <h1 className="mt-4 text-4xl font-semibold text-[#102A24] md:text-6xl">Friends</h1>
      <p className="mt-4 text-base leading-7 text-[#1A1D1A]/72">
        这里是本站统一的友链通信站，你可以查看本站信息、阅读申请规则，并直接留言申请。
      </p>
    </header>
  </div>
</section>
```

- [ ] **Step 3: Add responsive, page-specific styling choices inside the JSX class lists**

```jsx
className="rounded-[32px] border border-white/70 bg-white/55 p-6 shadow-[0_24px_80px_rgba(16,42,36,0.08)] backdrop-blur-xl"
```

```jsx
className="inline-flex min-h-[44px] items-center rounded-full bg-[#102A24] px-5 py-3 text-sm font-semibold text-[#F8F5EE] transition hover:bg-[#15382F]"
```

- [ ] **Step 4: Run a focused build for `main` and visually sanity-check the page**

Run: `npm run build`

Workdir: `D:\taozhiyy-monorepo\main`

Expected: build completes successfully and the Friends page component compiles without unused import or JSX errors.

- [ ] **Step 5: Commit**

```bash
git add main/src/components/FriendsApplicationBoard.jsx main/src/pages/FriendsPage.jsx
git commit -m "feat: design friends application page"
```

### Task 3: Remove old friend-link entry points from `build`

**Files:**
- Modify: `build/src/App.tsx`
- Modify: `build/src/components/Sidebar.tsx`
- Modify: `build/src/i18n/strings.ts`
- Delete: `build/src/pages/LinksPage.tsx` (if no longer referenced)

- [ ] **Step 1: Remove the `LinksPage` route and import from the build app**

```tsx
import { HomePage } from './pages/HomePage';
import { MomentsPage } from './pages/MomentsPage';
import { PostPage } from './pages/PostPage';
```

```tsx
<Route path="/moments" element={<MomentsPage />} />
<Route path="/gallery/*" element={<ExternalRedirect to="/gallery" />} />
<Route path="*" element={<Navigate to="/" replace />} />
```

- [ ] **Step 2: Remove the sidebar navigation item for `/links`**

```tsx
const NAV = [
  { to: '/', icon: '馃彔', key: 'navHome' as const },
  { to: '/archives', icon: '馃搨', key: 'navArchive' as const },
  { to: '/articles', icon: '馃摑', key: 'navArticle' as const },
  { to: '/moments', icon: '馃挰', key: 'navShuo' as const },
];
```

- [ ] **Step 3: Remove unused i18n strings related to links**

```ts
navLinks: '鍙嬮摼',
linksTitle: '鍙嬮摼',
linksLead: '娆㈣繋浜掓崲鍙嬮摼锛岃鍏堥槄璇昏鏄庛€?,
linksSiteH: '鏈珯淇℃伅',
linksExchangeH: '鐢宠鍙嬮摼',
linksFriendsH: '灏忎紮浼翠滑',
linksVisit: '璁块棶 鈫?,
linksExL1: '...',
linksExL2: '...',
linksExL3: '...',
```

- [ ] **Step 4: Run a focused build for `build`**

Run: `npm run build`

Workdir: `D:\taozhiyy-monorepo\build`

Expected: build completes successfully and no imports or translation keys reference the removed links page.

- [ ] **Step 5: Commit**

```bash
git add build/src/App.tsx build/src/components/Sidebar.tsx build/src/i18n/strings.ts build/src/pages/LinksPage.tsx
git commit -m "refactor: remove legacy build links entry"
```

### Task 4: Remove old friend-link entry points from `blog`

**Files:**
- Modify: `blog/_config.butterfly.yml`
- Delete: `blog/source/link/index.md`
- Delete: `blog/source/_data/link.yml`

- [ ] **Step 1: Remove the blog navigation menu entry**

```yml
menu:
  Home: / || fas fa-home
  Archives: /archives/ || fas fa-archive
  Tags: /tags/ || fas fa-tags
  Categories: /categories/ || fas fa-folder-open
  Moments: /shuoshuo/ || fas fa-pen-nib
  杩界暘: /bangumis/ || fas fa-play-circle
```

- [ ] **Step 2: Delete the old Hexo friend-link page and friend-link data file**

Run: `git rm blog/source/link/index.md blog/source/_data/link.yml`

Expected: both legacy friend-link content files are staged for deletion.

- [ ] **Step 3: Run a focused config/content sanity check**

Run: `rg -n "link|友链|LinksPage|/links" blog/_config.butterfly.yml blog/source`

Workdir: `D:\taozhiyy-monorepo`

Expected: no active blog navigation entry or friend-link page content remains, aside from unrelated words inside third-party theme comments.

- [ ] **Step 4: Commit**

```bash
git add blog/_config.butterfly.yml
git commit -m "refactor: remove blog friend links entry"
```

### Task 5: Final verification and cleanup

**Files:**
- Modify: `docs/superpowers/specs/2026-06-05-friends-hub-design.md` (only if the final implementation materially diverges)
- Modify: `docs/superpowers/plans/2026-06-05-friends-hub-implementation.md` (marking progress only if desired)

- [ ] **Step 1: Verify repo status**

Run: `git status --short`

Workdir: `D:\taozhiyy-monorepo`

Expected: only the intended Friends hub changes appear before the final commit decision.

- [ ] **Step 2: Re-run both production builds**

Run: `npm run build`

Workdir: `D:\taozhiyy-monorepo\main`

Expected: PASS

Run: `npm run build`

Workdir: `D:\taozhiyy-monorepo\build`

Expected: PASS

- [ ] **Step 3: Search for stale active friend-link entry points**

Run: `rg -n "/links|LinksPage|Link: /link/|source/link|navLinks|linksTitle" main build blog`

Workdir: `D:\taozhiyy-monorepo`

Expected: no active source references remain except the new `/friends` implementation and any intentionally unrelated archived/generated artifacts the team keeps outside the active app flow.

- [ ] **Step 4: Prepare the final git summary**

```bash
git diff --stat
```

- [ ] **Step 5: Commit**

```bash
git add main build blog docs/superpowers/plans/2026-06-05-friends-hub-implementation.md
git commit -m "feat: add unified friends hub"
```

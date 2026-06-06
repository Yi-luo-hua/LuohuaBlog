export const ownerConsoleScreens = [
  {
    id: "home",
    navLabel: "总览",
    icon: "H",
    title: "站长工作台",
    subtitle: "把内容交给控制器，把构建和发布交给自动化。",
  },
  {
    id: "article",
    navLabel: "发文章",
    icon: "W",
    title: "发布文章",
    subtitle: "写 Blog 或 Build 记录，体验一键发布流程。",
  },
  {
    id: "drafts",
    navLabel: "草稿箱",
    icon: "D",
    title: "草稿箱",
    subtitle: "单独管理文章草稿和待发布内容。",
  },
  {
    id: "gallery",
    navLabel: "传相册",
    icon: "G",
    title: "Gallery 图片",
    subtitle: "批量上传图片并模拟更新相册。",
  },
  {
    id: "friend",
    navLabel: "友链",
    icon: "F",
    title: "增加友链",
    subtitle: "填写信息并预览友链卡片。",
  },
  {
    id: "inbox",
    navLabel: "留言",
    icon: "M",
    title: "消息提醒",
    subtitle: "集中查看留言、朋友页评论和友链申请。",
  },
  {
    id: "ai",
    navLabel: "AI 状态",
    icon: "AI",
    title: "AI 调试区",
    subtitle: "把满意答案保存为用户侧固定回复。",
  },
];

export const ownerConsoleModules = [
  {
    id: "article",
    title: "发布文章",
    description: "Blog 文章与 Build 记录统一向导，写完一键发布。",
    icon: "W",
    tone: "blue",
    status: "草稿 2",
  },
  {
    id: "gallery",
    title: "Gallery 图片",
    description: "批量拖图、选择相册、模拟上传和发布流程。",
    icon: "G",
    tone: "green",
    status: "待上传 0",
  },
  {
    id: "friend",
    title: "增加友链",
    description: "输入站点信息，实时生成卡片预览。",
    icon: "F",
    tone: "rose",
    status: "申请 1",
  },
  {
    id: "inbox",
    title: "留言收件箱",
    description: "guestbook、friends、友链申请提醒集中处理。",
    icon: "M",
    tone: "sun",
    status: "新消息 3",
  },
];

export const ownerConsoleNotifications = [
  {
    title: "留言板新留言",
    source: "guestbook",
    detail: "有人在 guestbook 留了小纸条。",
    count: 1,
  },
  {
    title: "朋友页新评论",
    source: "friends",
    detail: "friends 区有新问候。",
    count: 1,
  },
  {
    title: "友链申请提醒",
    source: "申请",
    detail: "有一条待带入友链表单。",
    count: 1,
  },
];

export const ownerConsoleAvatars = [
  {
    id: "tc",
    label: "Taozhiyy Control",
    initial: "TC",
    gradient: "linear-gradient(135deg, #7bb7ff, #83d7cf)",
  },
  {
    id: "owner",
    label: "站长",
    initial: "站",
    gradient: "linear-gradient(135deg, #ff9fbd, #ffd56f)",
  },
  {
    id: "ai",
    label: "AI",
    initial: "AI",
    gradient: "linear-gradient(135deg, #9cc9ff, #c9b8ff)",
  },
  {
    id: "gallery",
    label: "Gallery",
    initial: "G",
    gradient: "linear-gradient(135deg, #83d899, #83d7cf)",
  },
  {
    id: "build",
    label: "Build",
    initial: "B",
    gradient: "linear-gradient(135deg, #6faeff, #ffb985)",
  },
];

export const publishSteps = [
  "检查内容",
  "上传图片",
  "生成页面",
  "发布到网站",
  "检查线上结果",
];

export function getNotificationTotal(notifications = ownerConsoleNotifications) {
  return notifications.reduce((total, item) => total + (item.count || 0), 0);
}

export function buildMobileArticleDraft(inputText) {
  const material = inputText?.trim() || "今天整理了一些图片和文字素材。";
  const title = material.includes("AI")
    ? "用 AI 代理完成一次移动端发文"
    : "手机端素材整理记录";
  const body = [
    `# ${title}`,
    "",
    "这篇文章由手机端 AI 代理根据站长提供的图片和文字素材整理生成。",
    "",
    "## 素材摘要",
    material,
    "",
    "## 发布建议",
    "- 自动补全标题、摘要、标签和基础排版",
    "- 图片会在正式版上传后插入正文",
    "- 站长审核通过后再进入自动化发布流程",
  ].join("\n");

  return { title, body };
}

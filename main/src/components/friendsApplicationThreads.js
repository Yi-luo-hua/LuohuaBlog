export const FRIEND_APPLICATION_TEMPLATE_FIELDS = [
  "站点名称",
  "站点链接",
  "站点描述",
  "头像链接",
];

export function isFriendApplicationContent(content = "") {
  return FRIEND_APPLICATION_TEMPLATE_FIELDS.every((field) => content.includes(field));
}

export function normalizeFriendsThreads(items = []) {
  return items
    .filter((item) => item.parentId === 0 && isFriendApplicationContent(item.content))
    .map((item) => ({
      ...item,
      replies: Array.isArray(item.replies) ? item.replies : [],
      replyCount:
        typeof item.replyCount === "number"
          ? item.replyCount
          : Array.isArray(item.replies)
            ? item.replies.length
            : 0,
    }));
}

export function flattenGuestbookThreads(items = []) {
  return items.flatMap((item) => {
    const replies = Array.isArray(item.replies) ? item.replies : [];
    if (replies.length === 0) return [item];
    return [item, ...replies];
  });
}

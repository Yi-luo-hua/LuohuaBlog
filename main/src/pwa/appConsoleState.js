export function getOwnerSessionLabel(ownerStatus) {
  if (!ownerStatus?.owner) return "未解锁";
  return ownerStatus.owner.displayName || "站长";
}

export function getBackendHealthLabel(health) {
  return health?.status || "检查中";
}

export function getOwnerGuestbookContacts(ownerEmails) {
  const items = ownerEmails?.guestbookContacts;
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item?.contactEmail)
    .map((item) => ({
      id: item.id,
      source: item.source || "",
      nickname: item.nickname || "",
      content: item.content || "",
      contactEmail: item.contactEmail,
      createdAt: item.createdAt || "",
    }));
}


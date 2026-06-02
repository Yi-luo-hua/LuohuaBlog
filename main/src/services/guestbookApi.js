import { mockGuestbookEntries } from "../data/acgMock";
import { apiUrl } from "../lib/apiBase";
import { asList } from "../lib/asList";

export async function getGuestbook(limit = 50) {
  try {
    const res = await fetch(apiUrl(`/api/v1/guestbook?limit=${limit}`), {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return asList(data);
  } catch {
    return [...mockGuestbookEntries];
  }
}

export async function postGuestbook({ name, content }) {
  const body = JSON.stringify({
    name: name.trim().slice(0, 32),
    content: content.trim().slice(0, 500),
  });

  try {
    const res = await fetch(apiUrl("/api/v1/guestbook"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch {
    return {
      id: Date.now(),
      name: name.trim(),
      content: content.trim(),
      createdAt: new Date().toISOString(),
      offline: true,
    };
  }
}

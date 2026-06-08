import test from "node:test";
import assert from "node:assert/strict";

import {
  isPublicImageURL,
  markOwnerNotificationRead,
  publishOwnerArticle,
  publishOwnerFriend,
  publishOwnerGalleryImage,
  publishOwnerMoment,
  uploadOwnerAsset,
} from "./ownerApi.js";

test("publishOwnerArticle posts to the real owner publish endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestURL = "";
  let requestOptions = null;
  globalThis.fetch = async (url, options = {}) => {
    requestURL = url;
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          item: {
            path: "blog/source/_posts/test-owner-publish.md",
            commitSha: "commit-sha",
          },
        };
      },
    };
  };

  const payload = {
    draftId: 7,
    title: "Test Owner Publish",
    body: "# Hello publish",
    coverUrl: "https://img.example/cover.png",
  };
  const result = await publishOwnerArticle(payload);

  assert.equal(requestURL, "/api/owner/publish");
  assert.equal(requestOptions.method, "POST");
  assert.equal(requestOptions.credentials, "include");
  assert.equal(requestOptions.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(requestOptions.body), payload);
  assert.equal(result.item.commitSha, "commit-sha");
});

test("uploadOwnerAsset posts multipart form to the owner assets endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestURL = "";
  let requestOptions = null;
  globalThis.fetch = async (url, options = {}) => {
    requestURL = url;
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return { ok: true, item: { url: "https://cdn.example/gallery/misaka/demo.png" } };
      },
    };
  };

  const file = new Blob(["demo"], { type: "image/png" });
  await uploadOwnerAsset(file, { kind: "gallery", album: "Misaka" });

  assert.equal(requestURL, "/api/owner/assets");
  assert.equal(requestOptions.method, "POST");
  assert.equal(requestOptions.credentials, "include");
  assert.ok(requestOptions.body instanceof FormData);
  assert.equal(requestOptions.body.get("kind"), "gallery");
  assert.equal(requestOptions.body.get("album"), "Misaka");
});

test("publishOwnerGalleryImage posts to the real gallery publish endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestURL = "";
  let requestOptions = null;
  globalThis.fetch = async (url, options = {}) => {
    requestURL = url;
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          item: {
            albumId: "misaka",
            imageUrl: "https://cdn.example/gallery/misaka/demo.png",
            path: "main/src/data/galleryAlbums.js",
            commitSha: "commit-sha",
          },
        };
      },
    };
  };

  const payload = {
    albumId: "misaka",
    albumTitle: "御坂美琴",
    imageUrl: "https://cdn.example/gallery/misaka/demo.png",
  };
  const result = await publishOwnerGalleryImage(payload);

  assert.equal(requestURL, "/api/owner/gallery/images");
  assert.equal(requestOptions.method, "POST");
  assert.equal(requestOptions.credentials, "include");
  assert.equal(requestOptions.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(requestOptions.body), payload);
  assert.equal(result.item.commitSha, "commit-sha");
});

test("markOwnerNotificationRead patches the real owner notification endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestURL = "";
  let requestOptions = null;
  globalThis.fetch = async (url, options = {}) => {
    requestURL = url;
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return { ok: true, id: 42, ownerReadAt: "2026-06-07T12:00:00Z" };
      },
    };
  };

  const result = await markOwnerNotificationRead(42);

  assert.equal(requestURL, "/api/owner/notifications/42/read");
  assert.equal(requestOptions.method, "PATCH");
  assert.equal(requestOptions.credentials, "include");
  assert.equal(result.ownerReadAt, "2026-06-07T12:00:00Z");
});

test("publishOwnerFriend posts to the real friend publish endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestURL = "";
  let requestOptions = null;
  globalThis.fetch = async (url, options = {}) => {
    requestURL = url;
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          item: {
            path: "main/src/data/friendCards.js",
            commitSha: "friend-commit-sha",
          },
        };
      },
    };
  };

  const payload = {
    name: "Example Friend",
    desc: "A readable friend card",
    url: "https://friend.example",
    avatar: "https://friend.example/avatar.png",
  };
  const result = await publishOwnerFriend(payload);

  assert.equal(requestURL, "/api/owner/friends");
  assert.equal(requestOptions.method, "POST");
  assert.equal(requestOptions.credentials, "include");
  assert.equal(requestOptions.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(requestOptions.body), payload);
  assert.equal(result.item.commitSha, "friend-commit-sha");
});

test("publishOwnerMoment posts category and content to the real moments endpoint", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  let requestURL = "";
  let requestOptions = null;
  globalThis.fetch = async (url, options = {}) => {
    requestURL = url;
    requestOptions = options;
    return {
      ok: true,
      async json() {
        return {
          ok: true,
          item: {
            path: "main/src/data/moments.js",
            commitSha: "moment-commit-sha",
          },
        };
      },
    };
  };

  const payload = {
    year: "2026",
    date: "6.8",
    type: "碎碎念",
    content: "今天也想把小碎片写下来",
  };
  const result = await publishOwnerMoment(payload);

  assert.equal(requestURL, "/api/owner/moments");
  assert.equal(requestOptions.method, "POST");
  assert.equal(requestOptions.credentials, "include");
  assert.equal(requestOptions.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(requestOptions.body), payload);
  assert.equal(result.item.commitSha, "moment-commit-sha");
});

test("isPublicImageURL accepts http and https urls", () => {
  assert.equal(isPublicImageURL("https://cdn.example/a.png"), true);
  assert.equal(isPublicImageURL("http://cdn.example/a.png"), true);
  assert.equal(isPublicImageURL("ftp://cdn.example/a.png"), false);
  assert.equal(isPublicImageURL(""), false);
});

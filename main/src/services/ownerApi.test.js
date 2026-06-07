import test from "node:test";
import assert from "node:assert/strict";

import {
  isPublicImageURL,
  publishOwnerArticle,
  publishOwnerGalleryImage,
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

test("isPublicImageURL accepts http and https urls", () => {
  assert.equal(isPublicImageURL("https://cdn.example/a.png"), true);
  assert.equal(isPublicImageURL("http://cdn.example/a.png"), true);
  assert.equal(isPublicImageURL("ftp://cdn.example/a.png"), false);
  assert.equal(isPublicImageURL(""), false);
});

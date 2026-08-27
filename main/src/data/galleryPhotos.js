// 相册照片。扁平列表，不分相册；站长控制台发布相册图片时会往数组开头插一条。
//
// 每条的字段：
//   id           路由用的唯一标识，/gallery/<id> 是这张图的详情页
//   src          同源的 /cos/... 路径，或公开图床的 https 地址
//   width/height 原图的像素尺寸；等高行排布靠它算每张图占多宽，缺了会跳版
//   thumb        可选，列表页用的小图；没有就用 src（详情页永远给 src 原图）
//   title        可选，一句话说明
//   publishedAt  ISO 时间，页面按它倒序排，新的在上面
export const galleryPhotos = [
  {
    id: "20260827-131926-494d98",
    src: "/cos/gallery/2026/08/abaf86343ad1da87.jpg",
    width: 1200,
    height: 565,
    thumb: "/cos/gallery/2026/08/abaf86343ad1da87-thumb.jpg",
    publishedAt: "2026-08-27T13:19:26Z",
  },
  {
    id: "20260827-131650-a08268",
    src: "/cos/gallery/2026/08/002a8b6cb8603d77.jpg",
    width: 1200,
    height: 685,
    thumb: "/cos/gallery/2026/08/002a8b6cb8603d77-thumb.jpg",
    publishedAt: "2026-08-27T13:16:50Z",
  },

  {
    id: "20260825-160758-6e482a",
    src: "/cos/gallery/2026/08/f5375ba8d7c4e33e.jpg",
    width: 1960,
    height: 3136,
    thumb: "/cos/gallery/2026/08/f5375ba8d7c4e33e-thumb.jpg",
    publishedAt: "2026-08-25T16:07:58Z",
  },
  {
    id: "20260825-160757-4ffa75",
    src: "/cos/gallery/2026/08/e4fb1a6a4dfce3b7.jpg",
    width: 1280,
    height: 2288,
    thumb: "/cos/gallery/2026/08/e4fb1a6a4dfce3b7-thumb.jpg",
    publishedAt: "2026-08-25T16:07:57Z",
  },
  {
    id: "20260825-160757-b553b1",
    src: "/cos/gallery/2026/08/c41cb3f5cb7b8924.jpg",
    width: 6552,
    height: 4488,
    thumb: "/cos/gallery/2026/08/c41cb3f5cb7b8924-thumb.jpg",
    publishedAt: "2026-08-25T16:07:57Z",
  },
  {
    id: "20260825-160757-51debb",
    src: "/cos/gallery/2026/08/e91896ec92dc0e84.jpg",
    width: 2800,
    height: 1840,
    thumb: "/cos/gallery/2026/08/e91896ec92dc0e84-thumb.jpg",
    publishedAt: "2026-08-25T16:07:57Z",
  },
  {
    id: "20260825-160757-99a122",
    src: "/cos/gallery/2026/08/0f5d29d70d9fa1e2.jpg",
    width: 2240,
    height: 1277,
    thumb: "/cos/gallery/2026/08/0f5d29d70d9fa1e2-thumb.jpg",
    publishedAt: "2026-08-25T16:07:57Z",
  },
  {
    id: "20260825-160757-290b5a",
    src: "/cos/gallery/2026/08/682760af2709720b.jpg",
    width: 1088,
    height: 1920,
    thumb: "/cos/gallery/2026/08/682760af2709720b-thumb.jpg",
    publishedAt: "2026-08-25T16:07:57Z",
  },
  {
    id: "20260825-160756-b4cd8a",
    src: "/cos/gallery/2026/08/d738fd756c170ce3.jpg",
    width: 1953,
    height: 3295,
    thumb: "/cos/gallery/2026/08/d738fd756c170ce3-thumb.jpg",
    publishedAt: "2026-08-25T16:07:56Z",
  },
  {
    id: "20260825-160756-ef228c",
    src: "/cos/gallery/2026/08/9c82764f6d8ee0d9.jpg",
    width: 1254,
    height: 1254,
    thumb: "/cos/gallery/2026/08/9c82764f6d8ee0d9-thumb.jpg",
    publishedAt: "2026-08-25T16:07:56Z",
  },
  {
    id: "20260825-160756-99376d",
    src: "/cos/gallery/2026/08/fd6a0c7b6e280106.jpg",
    width: 1448,
    height: 2048,
    thumb: "/cos/gallery/2026/08/fd6a0c7b6e280106-thumb.jpg",
    publishedAt: "2026-08-25T16:07:56Z",
  },
  {
    id: "20260825-160756-6381df",
    src: "/cos/gallery/2026/08/42619141d08ee402.jpg",
    width: 3360,
    height: 1440,
    thumb: "/cos/gallery/2026/08/42619141d08ee402-thumb.jpg",
    publishedAt: "2026-08-25T16:07:56Z",
  },
  {
    id: "20260824-142023-35196b",
    src: "/cos/gallery/2026/08/f14c87878f714a01.jpg",
    width: 832,
    height: 1216,
    thumb: "/cos/gallery/2026/08/f14c87878f714a01-thumb.jpg",
    publishedAt: "2026-08-24T14:20:23Z",
  },
  {
    id: "20260824-141942-144024",
    src: "/cos/gallery/2026/08/67afb3c4fa234699.jpg",
    width: 900,
    height: 1200,
    thumb: "/cos/gallery/2026/08/67afb3c4fa234699-thumb.jpg",
    publishedAt: "2026-08-24T14:19:42Z",
  },
  {
    id: "20260824-141917-d5b1aa",
    src: "/cos/gallery/2026/08/0a1c77be8864c06b.jpg",
    width: 2480,
    height: 3508,
    thumb: "/cos/gallery/2026/08/0a1c77be8864c06b-thumb.jpg",
    publishedAt: "2026-08-24T14:19:17Z",
  },
  {
    id: "20260824-141844-93082b",
    src: "/cos/gallery/2026/08/81b33fe2160a6557.jpg",
    width: 1200,
    height: 920,
    thumb: "/cos/gallery/2026/08/81b33fe2160a6557-thumb.jpg",
    publishedAt: "2026-08-24T14:18:44Z",
  },
  {
    id: "20260814-055330-bb19a4",
    src: "/cos/gallery/2026/08/e677adad00645622.png",
    width: 1770,
    height: 2452,
    thumb: "/cos/gallery/2026/08/e677adad00645622-thumb.jpg",
    publishedAt: "2026-08-14T05:53:30Z",
  },
  {
    id: "20260802-045948-03e2f7",
    src: "/cos/gallery/2026/08/24bc54db1b0381de.png",
    width: 3840,
    height: 2160,
    thumb: "/cos/gallery/2026/08/24bc54db1b0381de-thumb.jpg",
    publishedAt: "2026-08-02T04:59:48Z",
  },
  {
    id: "20260305-170951-591ab9",
    src: "/cos/gallery/2026/03/f2a668c0969c8268.jpg",
    width: 3792,
    height: 2048,
    thumb: "/cos/gallery/2026/03/f2a668c0969c8268-thumb.jpg",
    publishedAt: "2026-03-05T17:09:51Z",
  },
  {
    id: "20260305-165529-d95554",
    src: "/cos/gallery/2026/03/bdcb228702b09826.jpg",
    width: 2102,
    height: 3226,
    thumb: "/cos/gallery/2026/03/bdcb228702b09826-thumb.jpg",
    publishedAt: "2026-03-05T16:55:29Z",
  },
  {
    id: "20260219-144148-d32992",
    src: "/cos/gallery/2026/02/4a7aeac36e0d3c95.jpg",
    width: 928,
    height: 1232,
    thumb: "/cos/gallery/2026/02/4a7aeac36e0d3c95-thumb.jpg",
    publishedAt: "2026-02-19T14:41:48Z",
  },
  {
    id: "20260124-142341-b29dda",
    src: "/cos/gallery/2026/01/20a98c63de56b6a5.jpg",
    width: 675,
    height: 1200,
    thumb: "/cos/gallery/2026/01/20a98c63de56b6a5-thumb.jpg",
    publishedAt: "2026-01-24T14:23:41Z",
  },
  {
    id: "20260124-142014-ac6828",
    src: "/cos/gallery/2026/01/94a698d8121eb693.jpg",
    width: 1600,
    height: 1600,
    thumb: "/cos/gallery/2026/01/94a698d8121eb693-thumb.jpg",
    publishedAt: "2026-01-24T14:20:14Z",
  },
  {
    id: "20260124-142000-456027",
    src: "/cos/gallery/2026/01/0bb81e2cc910d77e.jpg",
    width: 1088,
    height: 674,
    thumb: "/cos/gallery/2026/01/0bb81e2cc910d77e-thumb.jpg",
    publishedAt: "2026-01-24T14:20:00Z",
  },
  {
    id: "20260124-141930-8be5ed",
    src: "/cos/gallery/2026/01/d951ced23593326f.jpg",
    width: 761,
    height: 1043,
    thumb: "/cos/gallery/2026/01/d951ced23593326f-thumb.jpg",
    publishedAt: "2026-01-24T14:19:30Z",
  },
  {
    id: "20260124-141859-2191a9",
    src: "/cos/gallery/2026/01/24edadcb4fb947b0.jpg",
    width: 724,
    height: 1023,
    thumb: "/cos/gallery/2026/01/24edadcb4fb947b0-thumb.jpg",
    publishedAt: "2026-01-24T14:18:59Z",
  },
  {
    id: "20260124-141753-b0eda6",
    src: "/cos/gallery/2026/01/f231d74e71aa0e4c.jpg",
    width: 768,
    height: 1024,
    thumb: "/cos/gallery/2026/01/f231d74e71aa0e4c-thumb.jpg",
    publishedAt: "2026-01-24T14:17:53Z",
  },
  {
    id: "20260124-141722-f5eae5",
    src: "/cos/gallery/2026/01/66bd1bc8bc935303.jpg",
    width: 1160,
    height: 1504,
    thumb: "/cos/gallery/2026/01/66bd1bc8bc935303-thumb.jpg",
    publishedAt: "2026-01-24T14:17:22Z",
  },
  {
    id: "20260124-141705-a71b40",
    src: "/cos/gallery/2026/01/63777fb31902051b.jpg",
    width: 1080,
    height: 1620,
    thumb: "/cos/gallery/2026/01/63777fb31902051b-thumb.jpg",
    publishedAt: "2026-01-24T14:17:05Z",
  },
  {
    id: "20260124-141516-4daae9",
    src: "/cos/gallery/2026/01/f06e54ed499e30c0.jpg",
    width: 1080,
    height: 1920,
    thumb: "/cos/gallery/2026/01/f06e54ed499e30c0-thumb.jpg",
    publishedAt: "2026-01-24T14:15:16Z",
  },
  {
    id: "20260124-141438-ee1bfc",
    src: "/cos/gallery/2026/01/2c4f5a6aab2e0567.jpg",
    width: 1080,
    height: 1920,
    thumb: "/cos/gallery/2026/01/2c4f5a6aab2e0567-thumb.jpg",
    publishedAt: "2026-01-24T14:14:38Z",
  },
  {
    id: "20260124-141330-d86b5d",
    src: "/cos/gallery/2026/01/ab63b32d81fffce7.jpg",
    width: 1599,
    height: 2262,
    thumb: "/cos/gallery/2026/01/ab63b32d81fffce7-thumb.jpg",
    publishedAt: "2026-01-24T14:13:30Z",
  },
  {
    id: "20260124-140201-1f13e5",
    src: "/cos/gallery/2026/01/4854fbd350986306.jpg",
    width: 1650,
    height: 1067,
    thumb: "/cos/gallery/2026/01/4854fbd350986306-thumb.jpg",
    publishedAt: "2026-01-24T14:02:01Z",
  },
  {
    id: "20260124-140200-1081e1",
    src: "/cos/gallery/2026/01/5f864454eb345d12.jpg",
    width: 920,
    height: 1300,
    thumb: "/cos/gallery/2026/01/5f864454eb345d12-thumb.jpg",
    publishedAt: "2026-01-24T14:02:00Z",
  },
  {
    id: "20260124-140200-10ee55",
    src: "/cos/gallery/2026/01/0f8e5b5c5d9424f1.jpg",
    width: 952,
    height: 1344,
    thumb: "/cos/gallery/2026/01/0f8e5b5c5d9424f1-thumb.jpg",
    publishedAt: "2026-01-24T14:02:00Z",
  },
  {
    id: "20260124-140159-24cdfd",
    src: "/cos/gallery/2026/01/22b1f689ba892307.jpg",
    width: 1225,
    height: 2280,
    thumb: "/cos/gallery/2026/01/22b1f689ba892307-thumb.jpg",
    publishedAt: "2026-01-24T14:01:59Z",
  },
  {
    id: "20250115-170613-599471",
    src: "/cos/gallery/2025/01/07508a48c0c161b2.jpg",
    width: 771,
    height: 1024,
    thumb: "/cos/gallery/2025/01/07508a48c0c161b2-thumb.jpg",
    publishedAt: "2025-01-15T17:06:13Z",
  },
];

const publishedTime = (photo) => {
  const parsed = Date.parse(photo?.publishedAt ?? "");
  return Number.isNaN(parsed) ? 0 : parsed;
};

// 发布接口本来就往数组开头插，这里再排一次，手写条目或时间戳错乱时也不会乱序。
export const galleryPhotosNewestFirst = [...galleryPhotos].sort(
  (a, b) => publishedTime(b) - publishedTime(a),
);

export const getGalleryPhoto = (id) =>
  galleryPhotosNewestFirst.find((photo) => photo.id === id);

export const getGalleryPhotoNeighbours = (id) => {
  const index = galleryPhotosNewestFirst.findIndex((photo) => photo.id === id);
  if (index < 0) return { previous: null, next: null, index: -1 };
  return {
    index,
    previous: galleryPhotosNewestFirst[index - 1] || null,
    next: galleryPhotosNewestFirst[index + 1] || null,
  };
};

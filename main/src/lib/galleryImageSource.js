// 相册图片地址：站内 /cos/... 的同源路径，或公开图床的 http(s) 地址。
// 后端 ownerIsGalleryImageSource 是同一套规则，改这里记得两边一起改。
const COS_PREFIX = "/cos/";

export function isGalleryImageSource(value) {
  const source = String(value ?? "").trim();
  if (!source) return false;
  // `//host/x` 是协议相对地址，看着像站内路径其实指向别处。
  if (source.startsWith("//")) return false;
  if (source.startsWith("/")) {
    return source.startsWith(COS_PREFIX) && source.length > COS_PREFIX.length;
  }

  try {
    const url = new URL(source);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// 等高行排布靠原始像素尺寸算宽度，所以发布前必须先量出来。
const MAX_DIMENSION = 100000;

export function areUsableDimensions(width, height) {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= MAX_DIMENSION &&
    height <= MAX_DIMENSION
  );
}

export function measureImageSource(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () =>
      reject(new Error("读不出这张图片的尺寸，确认一下地址能不能公开访问。"));
    image.src = src;
  });
}

export async function measureImageFile(file) {
  const objectURL = URL.createObjectURL(file);
  try {
    return await measureImageSource(objectURL);
  } finally {
    URL.revokeObjectURL(objectURL);
  }
}

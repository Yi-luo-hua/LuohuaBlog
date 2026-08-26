// 等高行排布。同一行的照片共享高度、宽度按各自的原始比例走，整行铺满容器宽度——
// Google Photos / Flickr 那种排法。横图竖图混排不会互相挤，也不裁剪、不变形。
//
// 纯函数，不碰 DOM：进去是照片列表和容器宽度，出来是每行的高度和每张图的像素尺寸。

// 没有宽高信息时按 3:2 当占位，至少不会让照片从页面上消失。
export const DEFAULT_ASPECT = 3 / 2;

export const photoAspect = (photo) => {
  const width = Number(photo?.width);
  const height = Number(photo?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return DEFAULT_ASPECT;
  if (width <= 0 || height <= 0) return DEFAULT_ASPECT;
  return width / height;
};

const naturalHeight = (photo) => {
  const height = Number(photo?.height);
  return Number.isFinite(height) && height > 0 ? height : Infinity;
};

export function buildJustifiedRows(photos, options = {}) {
  const {
    containerWidth = 0,
    gap = 16,
    targetRowHeight = 280,
    maxRowHeight = targetRowHeight * 1.75,
  } = options;

  if (!Array.isArray(photos) || photos.length === 0) return [];
  if (!(containerWidth > 0)) return [];

  // 一行铺满容器时的高度：可用宽度按这一行所有宽高比之和分摊。
  const fittedHeight = (entries) => {
    const totalAspect = entries.reduce((sum, entry) => sum + entry.aspect, 0);
    if (totalAspect <= 0) return targetRowHeight;
    return (containerWidth - gap * (entries.length - 1)) / totalAspect;
  };

  const rows = [];
  let current = [];

  const closeRow = (entries, isLastRow) => {
    const fitted = fittedHeight(entries);
    // 最后一行照片不够铺满时不硬撑，否则单张图会被放大到离谱的高度。
    let height = isLastRow ? Math.min(targetRowHeight, fitted) : Math.min(fitted, maxRowHeight);
    // 绝不把照片放大到超过原始像素高度——宁可这一行不铺满，也不糊。
    height = Math.min(height, ...entries.map((entry) => naturalHeight(entry.photo)));

    rows.push({
      height,
      items: entries.map((entry) => ({
        photo: entry.photo,
        width: height * entry.aspect,
        height,
      })),
    });
  };

  for (const photo of photos) {
    const entry = { photo, aspect: photoAspect(photo) };
    if (current.length === 0) {
      current.push(entry);
      continue;
    }

    // 收进本行还是另起一行？谁算出来的行高离目标高度更近就听谁的。
    // 少了这一步，窄屏上会把两张图硬塞进一行、压成一条。
    const withEntry = fittedHeight([...current, entry]);
    const withoutEntry = fittedHeight(current);
    if (Math.abs(withoutEntry - targetRowHeight) <= Math.abs(withEntry - targetRowHeight)) {
      closeRow(current, false);
      current = [entry];
    } else {
      current.push(entry);
    }
  }

  if (current.length > 0) closeRow(current, true);

  return rows;
}

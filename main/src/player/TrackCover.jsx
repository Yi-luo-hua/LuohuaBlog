import { useEffect, useState } from "react";
import { FiMusic } from "react-icons/fi";
import { trackTint } from "./trackAccent.js";

// 封面。缺省时是一块近乎中性的深色玻璃，只掺一点按曲目 id 散列出的低饱和
// 色调让占位彼此可分——高饱和色块才是"塑料感"的来源。
//
// 封面地址取不到时（曲库没同步、路径挂了、网络断了）退回同一块占位，
// 而不是把浏览器的碎图标留在版面上。
const TrackCover = ({ track, className = "", iconClassName = "size-5" }) => {
  const src = track?.cover || null;
  const [failed, setFailed] = useState(false);

  // 换曲要重置，否则上一首加载失败会连累下一首
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} shrink-0 object-cover`}
      />
    );
  }

  const { h, s, l } = trackTint(track?.id);
  return (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center border border-white/10`}
      style={{
        background: `linear-gradient(155deg, hsl(${h} ${s}% ${l}%), hsl(${(h + 20) % 360} ${Math.max(s - 6, 8)}% ${Math.max(l - 12, 12)}%))`,
        color: "rgba(255, 255, 255, 0.45)",
      }}
    >
      <FiMusic className={iconClassName} />
    </span>
  );
};

export default TrackCover;

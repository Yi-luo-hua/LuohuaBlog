import { FiMusic } from "react-icons/fi";

// 封面缺省时给一个渐变占位。播放条、/music 页与关于页卡片共用，
// 保证三处对"没有封面"的降级表现一致。
const TrackCover = ({ track, className = "", iconClassName = "size-5" }) => {
  if (track?.cover) {
    return (
      <img
        src={track.cover}
        alt=""
        loading="lazy"
        className={`${className} object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${className} grid shrink-0 place-items-center bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-400 text-white/90`}
    >
      <FiMusic className={iconClassName} />
    </span>
  );
};

export default TrackCover;

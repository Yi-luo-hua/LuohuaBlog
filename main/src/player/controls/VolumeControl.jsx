import { FiVolume1, FiVolume2, FiVolumeX } from "react-icons/fi";
import IconButton from "./IconButton.jsx";

// 静音键 + 音量条。图标跟着音量分三档，比只有"响/静音"两态更好读。
const VolumeControl = ({ volume, muted, onToggleMute, onChange, className = "" }) => {
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? FiVolumeX : level < 0.5 ? FiVolume1 : FiVolume2;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <IconButton
        icon={Icon}
        label={muted ? "取消静音" : "静音"}
        onClick={onToggleMute}
        size={32}
        iconSize={17}
      />
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={level}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="音量"
        aria-valuetext={`${Math.round(level * 100)}%`}
        className="player-range w-20"
        style={{ "--range-fill": `${level * 100}%`, "--range-thickness": "3px", "--range-thumb": "9px" }}
      />
    </div>
  );
};

export default VolumeControl;

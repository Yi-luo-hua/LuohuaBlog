// 播放清单。数组顺序即页面展示顺序，新歌在前面；tools/sync_music.py 重新生成时
// 会整体覆盖本文件，所以长期曲目请维护在那个脚本的 PRESET_TRACKS 常量里。
//
// 每条的字段：
//   id        唯一标识（音频内容 sha1 前 16 位），播放器状态恢复靠它定位
//   title     歌名；无标签文件由同步脚本用文件名兜底
//   artist    歌手
//   album     可选，专辑名
//   src       音频地址；自托管曲库是 /audio/<id>.<ext>，
//             仓库自带的曲子仍走 /cos/ 前缀（中文路径必须保持 URL 编码原样）
//   cover     可选，封面图地址；缺省时 UI 用默认渐变封面
//   duration  时长（秒），同步脚本用 mutagen 现测；0 表示未知，播放器加载后自动取真值
//   addedAt   ISO 时间，仅用于展示与排序
export const musicTracks = [
  {
    id: "preset-loop",
    title: "it's 6pm but I miss u already",
    artist: "YaoNie",
    album: "",
    src: "/cos/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/main/audio/loop.mp3",
    cover: null,
    duration: 248.66,
    addedAt: "2026-08-30T00:00:00Z",
  },

  {
    id: "5032366e9ee9c174",
    title: "天球の奇蹟",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/5032366e9ee9c174.flac",
    cover: "/audio/5032366e9ee9c174.cover.jpg",
    duration: 154.88,
    addedAt: "2026-05-26T06:40:17Z",
  },
];

export const getMusicTrack = (id) =>
  musicTracks.find((track) => track.id === id) || null;

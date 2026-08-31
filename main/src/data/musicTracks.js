// 播放清单。数组顺序即页面展示顺序，新歌在前面；tools/sync_music.py 重新生成时
// 会整体覆盖本文件，所以想置顶的曲目请维护在那个脚本的 PRESET_TRACKS 常量里。
//
// 每条的字段：
//   id        唯一标识（音频内容 sha1 前 16 位），播放器状态恢复靠它定位
//   title     歌名；无标签文件由同步脚本用文件名兜底
//   artist    歌手
//   album     可选，专辑名
//   src       音频地址；自托管曲库是 /audio/<id>.<ext>
//             （手写的仓库内曲目走 /cos/ 前缀，中文路径需保持 URL 编码原样）
//   cover     可选，封面图地址；缺省时 UI 用默认渐变封面
//   duration  时长（秒），同步脚本用 mutagen 现测；0 表示未知，播放器加载后自动取真值
//   addedAt   ISO 时间，仅用于展示与排序
export const musicTracks = [
  {
    id: "8463e47d12c34bf2",
    title: "風の筆射す春日花抄",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/8463e47d12c34bf2.m4a",
    cover: "/audio/8463e47d12c34bf2.cover.jpg",
    duration: 98.03,
    addedAt: "2026-05-26T06:40:35Z",
  },

  {
    id: "2f2d89b9073dad76",
    title: "ありがとう在りし日",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/2f2d89b9073dad76.m4a",
    cover: "/audio/2f2d89b9073dad76.cover.jpg",
    duration: 137.35,
    addedAt: "2026-05-26T06:40:20Z",
  },

  {
    id: "8547beee6935c1cb",
    title: "シューマン交響曲第一番的日常",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/8547beee6935c1cb.m4a",
    cover: "/audio/8547beee6935c1cb.cover.jpg",
    duration: 192.56,
    addedAt: "2026-05-26T06:40:18Z",
  },

  {
    id: "5032366e9ee9c174",
    title: "天球の奇蹟",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/5032366e9ee9c174.m4a",
    cover: "/audio/5032366e9ee9c174.cover.jpg",
    duration: 154.88,
    addedAt: "2026-05-26T06:40:17Z",
  },

  {
    id: "e315a2cbc8e98aff",
    title: "軽やかに! 軽やかに!",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/e315a2cbc8e98aff.m4a",
    cover: "/audio/e315a2cbc8e98aff.cover.jpg",
    duration: 147.89,
    addedAt: "2026-05-26T06:40:10Z",
  },

  {
    id: "f22cd9bbbd315099",
    title: "夜空は奏でるだろう",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/f22cd9bbbd315099.m4a",
    cover: "/audio/f22cd9bbbd315099.cover.jpg",
    duration: 121.79,
    addedAt: "2026-05-26T06:40:05Z",
  },

  {
    id: "50c4450d26305060",
    title: "真っ赤な真実",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/50c4450d26305060.m4a",
    cover: "/audio/50c4450d26305060.cover.jpg",
    duration: 71.11,
    addedAt: "2026-05-26T06:40:04Z",
  },

  {
    id: "9cb60f61eb3385f8",
    title: "優雅な音階",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/9cb60f61eb3385f8.m4a",
    cover: "/audio/9cb60f61eb3385f8.cover.jpg",
    duration: 121.63,
    addedAt: "2026-05-26T06:39:57Z",
  },

  {
    id: "e927446885a75461",
    title: "空を舞う月 空を舞う翼",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/e927446885a75461.m4a",
    cover: "/audio/e927446885a75461.cover.jpg",
    duration: 109.35,
    addedAt: "2026-05-26T06:39:56Z",
  },

  {
    id: "199446c6cbbf6490",
    title: "ジムノペディ",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/199446c6cbbf6490.m4a",
    cover: "/audio/199446c6cbbf6490.cover.jpg",
    duration: 92.29,
    addedAt: "2026-05-26T06:39:55Z",
  },

  {
    id: "9b31d1e514925dee",
    title: "在りし日のために -inst ver-",
    artist: "ピクセルビー",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/9b31d1e514925dee.m4a",
    cover: "/audio/9b31d1e514925dee.cover.jpg",
    duration: 214.71,
    addedAt: "2026-05-26T06:39:49Z",
  },

  {
    id: "60073b70dbada9a7",
    title: "♪模型",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/60073b70dbada9a7.m4a",
    cover: "/audio/60073b70dbada9a7.cover.jpg",
    duration: 139.83,
    addedAt: "2026-05-26T06:39:47Z",
  },

  {
    id: "706388257d80d8ae",
    title: "心象の中の光",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/706388257d80d8ae.m4a",
    cover: "/audio/706388257d80d8ae.cover.jpg",
    duration: 190.39,
    addedAt: "2026-05-26T06:39:34Z",
  },

  {
    id: "06bd3bce67c3c078",
    title: "月の眼球譚",
    artist: "松本文紀/ピクセルビー",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/06bd3bce67c3c078.m4a",
    cover: "/audio/06bd3bce67c3c078.cover.jpg",
    duration: 144.13,
    addedAt: "2026-05-26T06:39:17Z",
  },

  {
    id: "57c41e3aef258722",
    title: "呼吸のように筆は踊る",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/57c41e3aef258722.m4a",
    cover: "/audio/57c41e3aef258722.cover.jpg",
    duration: 117.75,
    addedAt: "2026-05-26T06:39:04Z",
  },

  {
    id: "dac9fb938534db9a",
    title: "因果的交流の世界",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/dac9fb938534db9a.m4a",
    cover: "/audio/dac9fb938534db9a.cover.jpg",
    duration: 75.11,
    addedAt: "2026-05-26T06:39:01Z",
  },

  {
    id: "b6df8e9e3c628a5c",
    title: "夢の歩みを見上げて",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/b6df8e9e3c628a5c.m4a",
    cover: "/audio/b6df8e9e3c628a5c.cover.jpg",
    duration: 134.33,
    addedAt: "2026-05-26T06:39:00Z",
  },

  {
    id: "3ff8d2dce4e46e1d",
    title: "舞い上がる因果交流",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/3ff8d2dce4e46e1d.m4a",
    cover: "/audio/3ff8d2dce4e46e1d.cover.jpg",
    duration: 227.64,
    addedAt: "2026-05-26T06:38:55Z",
  },

  {
    id: "ee2c3bb6bc98ca7e",
    title: "花弁となり桜は大いに歌う",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/ee2c3bb6bc98ca7e.m4a",
    cover: "/audio/ee2c3bb6bc98ca7e.cover.jpg",
    duration: 111.48,
    addedAt: "2026-05-26T06:38:36Z",
  },

  {
    id: "aeb479df756f43b1",
    title: "透明な白い日常",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/aeb479df756f43b1.m4a",
    cover: "/audio/aeb479df756f43b1.cover.jpg",
    duration: 106.31,
    addedAt: "2026-05-26T06:38:32Z",
  },

  {
    id: "07f8ea9ac5f24c32",
    title: "心模型",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/07f8ea9ac5f24c32.m4a",
    cover: "/audio/07f8ea9ac5f24c32.cover.jpg",
    duration: 172.49,
    addedAt: "2026-05-26T06:38:27Z",
  },

  {
    id: "5d72f335a3b3981b",
    title: "ZYPRESSENは櫻に変わる",
    artist: "松本文紀/ピクセルビー",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/5d72f335a3b3981b.m4a",
    cover: "/audio/5d72f335a3b3981b.cover.jpg",
    duration: 128.65,
    addedAt: "2026-05-26T06:38:17Z",
  },

  {
    id: "cc5ad43f8b71f0af",
    title: "この櫻ノ詩の下",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/cc5ad43f8b71f0af.m4a",
    cover: "/audio/cc5ad43f8b71f0af.cover.jpg",
    duration: 114.75,
    addedAt: "2026-05-26T06:38:15Z",
  },

  {
    id: "100f2e698250c7a5",
    title: "ざくざくと散る錆びた夢",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/100f2e698250c7a5.m4a",
    cover: "/audio/100f2e698250c7a5.cover.jpg",
    duration: 206.25,
    addedAt: "2026-05-26T06:38:11Z",
  },

  {
    id: "e9716935e832c8dc",
    title: "花弁となり 世界は大いに歌う",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/e9716935e832c8dc.m4a",
    cover: "/audio/e9716935e832c8dc.cover.jpg",
    duration: 155.43,
    addedAt: "2026-05-26T06:38:09Z",
  },

  {
    id: "75a9802d0d8266c7",
    title: "君が立つ大地だ",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/75a9802d0d8266c7.m4a",
    cover: "/audio/75a9802d0d8266c7.cover.jpg",
    duration: 178.87,
    addedAt: "2026-05-26T06:38:03Z",
  },

  {
    id: "c694a21d882193a6",
    title: "色彩力無限",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/c694a21d882193a6.m4a",
    cover: "/audio/c694a21d882193a6.cover.jpg",
    duration: 102.01,
    addedAt: "2026-05-26T06:37:56Z",
  },

  {
    id: "337a7009faab1fd0",
    title: "数秒交差",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/337a7009faab1fd0.m4a",
    cover: "/audio/337a7009faab1fd0.cover.jpg",
    duration: 122.72,
    addedAt: "2026-05-26T06:37:53Z",
  },

  {
    id: "17b124a679487ba8",
    title: "透明な嘘の花",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/17b124a679487ba8.m4a",
    cover: "/audio/17b124a679487ba8.cover.jpg",
    duration: 109.93,
    addedAt: "2026-05-26T06:37:50Z",
  },

  {
    id: "e578a480ada29150",
    title: "紳士ゲェム",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/e578a480ada29150.m4a",
    cover: "/audio/e578a480ada29150.cover.jpg",
    duration: 60.28,
    addedAt: "2026-05-26T06:37:48Z",
  },

  {
    id: "b6e4f8449e7b2d1b",
    title: "遊ぶ絵画",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/b6e4f8449e7b2d1b.m4a",
    cover: "/audio/b6e4f8449e7b2d1b.cover.jpg",
    duration: 137.35,
    addedAt: "2026-05-26T06:37:44Z",
  },

  {
    id: "2a9de3ee13c70797",
    title: "昼間の絵画達",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/2a9de3ee13c70797.m4a",
    cover: "/audio/2a9de3ee13c70797.cover.jpg",
    duration: 152.51,
    addedAt: "2026-05-26T06:37:40Z",
  },

  {
    id: "52922309d660f7e1",
    title: "君の筆は世界を奏でる",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/52922309d660f7e1.m4a",
    cover: "/audio/52922309d660f7e1.cover.jpg",
    duration: 108.0,
    addedAt: "2026-05-26T06:37:20Z",
  },

  {
    id: "553613d83b5acc43",
    title: "夜の流れはゆっくりと",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/553613d83b5acc43.m4a",
    cover: "/audio/553613d83b5acc43.cover.jpg",
    duration: 125.76,
    addedAt: "2026-05-26T06:37:15Z",
  },

  {
    id: "7973aa0c1f7068cb",
    title: "陽射し入る窓",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/7973aa0c1f7068cb.m4a",
    cover: "/audio/7973aa0c1f7068cb.cover.jpg",
    duration: 109.77,
    addedAt: "2026-05-26T06:37:09Z",
  },

  {
    id: "c36be0959a6d97a5",
    title: "音符は歩き出す",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/c36be0959a6d97a5.m4a",
    cover: "/audio/c36be0959a6d97a5.cover.jpg",
    duration: 122.2,
    addedAt: "2026-05-26T06:37:05Z",
  },

  {
    id: "23133a17c0034672",
    title: "バカはバカのごとく現れる",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/23133a17c0034672.m4a",
    cover: "/audio/23133a17c0034672.cover.jpg",
    duration: 146.17,
    addedAt: "2026-05-26T06:37:05Z",
  },

  {
    id: "e6f4488426c50e4f",
    title: "螺旋に伸びる色彩",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/e6f4488426c50e4f.m4a",
    cover: "/audio/e6f4488426c50e4f.cover.jpg",
    duration: 133.72,
    addedAt: "2026-05-26T06:37:01Z",
  },

  {
    id: "d4dfa609ecdbf3ee",
    title: "瞬間を閉じ込めた永遠",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/d4dfa609ecdbf3ee.m4a",
    cover: "/audio/d4dfa609ecdbf3ee.cover.jpg",
    duration: 130.35,
    addedAt: "2026-05-26T06:36:56Z",
  },

  {
    id: "de665ef1fdd14b5f",
    title: "絵画は歌う",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/de665ef1fdd14b5f.m4a",
    cover: "/audio/de665ef1fdd14b5f.cover.jpg",
    duration: 120.08,
    addedAt: "2026-05-26T06:36:55Z",
  },

  {
    id: "f49ec382a17c7058",
    title: "舞い上がる因果交流のひかり",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/f49ec382a17c7058.m4a",
    cover: "/audio/f49ec382a17c7058.cover.jpg",
    duration: 145.29,
    addedAt: "2026-05-26T06:36:48Z",
  },

  {
    id: "9b9e869d5bc0bec2",
    title: "見上げた青の果て",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/9b9e869d5bc0bec2.m4a",
    cover: "/audio/9b9e869d5bc0bec2.cover.jpg",
    duration: 129.92,
    addedAt: "2026-05-26T06:36:45Z",
  },

  {
    id: "08bae873c0f9feca",
    title: "美しい音色で世界が鳴った",
    artist: "松本文紀",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/08bae873c0f9feca.m4a",
    cover: "/audio/08bae873c0f9feca.cover.jpg",
    duration: 140.71,
    addedAt: "2026-05-26T06:36:43Z",
  },

  {
    id: "b9257e014b32b7e7",
    title: "櫻ノ詩 (OP short ver)",
    artist: "はな",
    album: "サクラノ詩 サウンドトラックCD",
    src: "/audio/b9257e014b32b7e7.m4a",
    cover: "/audio/b9257e014b32b7e7.cover.jpg",
    duration: 105.85,
    addedAt: "2026-05-26T06:36:42Z",
  },
];

export const getMusicTrack = (id) =>
  musicTracks.find((track) => track.id === id) || null;

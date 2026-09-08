// Curated metadata; commercial recordings are linked externally, never rehosted.
export const songs = [
  {
    id: "nas-world",
    title: "The World Is Yours",
    artist: "Nas",
    style: "Boom bap",
    mood: "沉思",
    color: "#ccb468",
    note: "留意叙事视角与句尾落点，练习从日常观察展开 Verse。",
  },
  {
    id: "kendrick-alright",
    title: "Alright",
    artist: "Kendrick Lamar",
    style: "West Coast",
    mood: "振奋",
    color: "#abb8d0",
    note: "听副歌如何用重复建立记忆点，再写一句属于你的宣言。",
  },
  {
    id: "jcole-middle",
    title: "MIDDLE CHILD",
    artist: "J. Cole",
    style: "Trap",
    mood: "自信",
    color: "#d3a5aa",
    note: "关注短句、停顿和重音的对比，用留白让 Punchline 更突出。",
  },
  {
    id: "nujabes-feather",
    title: "Feather",
    artist: "Nujabes",
    style: "Jazz rap",
    mood: "放松",
    color: "#9dc2b8",
    note: "感受轻盈的节奏语气，先用自然说话的方式找 Flow。",
  },
  {
    id: "tribe-electric",
    title: "Electric Relaxation",
    artist: "A Tribe Called Quest",
    style: "Jazz rap",
    mood: "放松",
    color: "#d79a66",
    note: "感受松弛的语气与节拍关系，尝试减少每句的字数。",
  },
  {
    id: "eminem-lose",
    title: "Lose Yourself",
    artist: "Eminem",
    style: "Hardcore",
    mood: "振奋",
    color: "#b9bd8d",
    note: "观察故事如何逐步累积张力，给自己的 Verse 安排一个转折。",
  },
].map((song) => ({
  ...song,
  url: `https://music.youtube.com/search?q=${encodeURIComponent(song.artist + " " + song.title)}`,
}));
export function recommend(
  { mood = "", style = "", q = "" } = {},
  favorites = [],
) {
  return songs
    .filter(
      (s) =>
        (!mood || s.mood === mood) &&
        (!style || s.style === style) &&
        `${s.title} ${s.artist}`.toLowerCase().includes(q.toLowerCase()),
    )
    .map((s) => ({
      ...s,
      favorite: favorites.includes(s.id),
      reason: mood ? `符合「${mood}」心情 · ${s.note}` : s.note,
    }));
}

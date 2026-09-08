import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Headphones,
  Compass,
  MessageCircle,
  PenLine,
  Mic,
  Users,
  Heart,
  ArrowUpRight,
  ArrowRight,
  Play,
  Square,
  Send,
  Music2,
  LogOut,
  UserRound,
  Save,
  Volume2,
  Upload,
  Plus,
  Check,
} from "lucide-react";
import { api, type User, type Song, type Message, type Post } from "./api";
import "./styles.css";
type Page =
  "discover" | "chat" | "write" | "practice" | "community" | "profile";
const navigation = [
  { id: "discover", label: "发现音乐", icon: Compass },
  { id: "chat", label: "Rap 伙伴", icon: MessageCircle },
  { id: "write", label: "写词工作台", icon: PenLine },
  { id: "practice", label: "练习室", icon: Mic },
  { id: "community", label: "作品社区", icon: Users },
] as const;
function App() {
  const [page, commitPage] = useState<Page>("discover"),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [aiMode, setAiMode] = useState("demo");
  const [login, setLogin] = useState(false),
    [notice, setNotice] = useState("");
  const leaveGuard = useRef<() => boolean>(() => true);
  const setPage = (next: Page) => {
    if (next === page || leaveGuard.current()) commitPage(next);
  };
  const [audio, setAudio] = useState<{ url: string; name: string } | null>(
      null,
    ),
    audioUrl = useRef("");
  useEffect(() => {
    Promise.all([
      api<{ user: User | null }>("/auth/me"),
      api<{ aiMode: string }>("/health"),
    ])
      .then(([a, b]) => {
        setUser(a.user);
        setAiMode(b.aiMode);
      })
      .catch((e) => setNotice(e.message))
      .finally(() => setReady(true));
    return () => {
      if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    };
  }, []);
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  const requireLogin = () => {
    if (!user) {
      setLogin(true);
      return false;
    }
    return true;
  };
  const loadAudio = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setNotice("请选择音频文件");
      return;
    }
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = URL.createObjectURL(file);
    setAudio({ url: audioUrl.current, name: file.name });
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setPage("discover");
          }}
        >
          <span className="brand-symbol">
            <Headphones size={24} />
          </span>
          <span>
            WannaRap<small>想 要 说 唱</small>
          </span>
        </a>
        <div className="nav-label">YOUR CREATIVE SPACE</div>
        <nav aria-label="主要导航">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "nav-item active" : "nav-item"}
              onClick={() => setPage(id)}
            >
              <Icon size={20} />
              {label}
              {page === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-note">
          <span className="eyebrow">MAKE SOME NOISE</span>
          <p>
            每一个好 Verse，
            <br />
            都从第一句开始。
          </p>
          <button className="text-button" onClick={() => setPage("write")}>
            记下灵感 <ArrowUpRight size={17} />
          </button>
        </div>
        <button
          className="account"
          onClick={() => (user ? setPage("profile") : setLogin(true))}
        >
          <span className="avatar">
            {user ? user.username.slice(0, 1) : <UserRound size={19} />}
          </span>
          <span>
            {user?.username || "加入 WannaRap"}
            <small>{user ? "查看我的成长" : "登录，保存你的灵感"}</small>
          </span>
          <ArrowUpRight size={17} />
        </button>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>
            THE HIP-HOP COMPANION <span className="slash">/</span>{" "}
            {navigation.find((n) => n.id === page)?.label || "我的空间"}
          </span>
          <button className="status-pill" onClick={() => setPage("chat")}>
            <span className="status-dot" />
            {aiMode === "live" ? "AI 已配置" : "AI 演示模式"}
          </button>
        </header>
        <main key={`${page}-${user?.id || "guest"}`}>
          {!ready ? (
            <div className="empty">正在连接 WannaRap…</div>
          ) : (
            <>
              {page === "discover" && (
                <Discover
                  requireLogin={requireLogin}
                  notify={setNotice}
                  go={setPage}
                />
              )}
              {page === "chat" && (
                <Chat
                  user={user}
                  requireLogin={requireLogin}
                  notify={setNotice}
                  aiMode={aiMode}
                />
              )}
              {page === "write" && (
                <Writing
                  guard={leaveGuard}
                  user={user}
                  requireLogin={requireLogin}
                  notify={setNotice}
                  aiMode={aiMode}
                />
              )}
              {page === "practice" && (
                <Practice
                  requireLogin={requireLogin}
                  notify={setNotice}
                  loadAudio={loadAudio}
                />
              )}
              {page === "community" && (
                <Community requireLogin={requireLogin} notify={setNotice} />
              )}
              {page === "profile" && (
                <Profile
                  user={user}
                  go={setPage}
                  notify={setNotice}
                  logout={async () => {
                    try {
                      await api("/auth/logout", "POST", {});
                      setUser(null);
                      setPage("discover");
                    } catch (e) {
                      setNotice((e as Error).message);
                    }
                  }}
                />
              )}
            </>
          )}
        </main>
        <footer className="player">
          <span className="player-icon">
            <Music2 size={22} />
          </span>
          <div className="track-info">
            <strong>{audio?.name || "把你的 Demo 带进来"}</strong>
            <small>
              {audio
                ? "本地播放 · 文件不会上传"
                : "播放本地音频，找到自己的 Flow"}
            </small>
          </div>
          {audio && (
            <audio
              key={audio.url}
              src={audio.url}
              controls
              onError={() => setNotice("音频无法播放，请尝试 MP3 或 WAV 文件")}
            />
          )}
          <label className="button secondary file-button">
            <Upload size={17} />
            选择音频
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => loadAudio(e.target.files?.[0])}
            />
          </label>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {login && (
        <Auth
          close={() => setLogin(false)}
          success={(u) => {
            setUser(u);
            setLogin(false);
            setNotice("已登录，开始你的创作吧");
          }}
        />
      )}
    </div>
  );
}
type Shared = { requireLogin: () => boolean; notify: (s: string) => void };
function Title({
  label,
  title,
  detail,
}: {
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="page-heading">
      <span className="eyebrow">{label}</span>
      <h1>
        {title}
        <span className="lime">.</span>
      </h1>
      <p>{detail}</p>
    </div>
  );
}
function Discover({
  requireLogin,
  notify,
  go,
}: Shared & { go: (p: Page) => void }) {
  const [songs, setSongs] = useState<Song[]>([]),
    [mood, setMood] = useState(""),
    [style, setStyle] = useState(""),
    [q, setQ] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<{ songs: Song[] }>(`/songs?${new URLSearchParams({ mood, style, q })}`)
      .then((r) => {
        if (active) setSongs(r.songs);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mood, style, q]);
  return (
    <>
      <section className="discovery-intro">
        <Title
          label="DISCOVER YOUR NEXT FLOW"
          title="今天，跟着感觉走"
          detail="找到对的声音，然后写下属于你的故事。"
        />
        <button className="button secondary" onClick={() => go("chat")}>
          <MessageCircle size={17} />和 Rap 伙伴聊聊 <ArrowUpRight size={16} />
        </button>
      </section>
      <section className="feature-strip">
        <div>
          <span className="eyebrow">THE DAILY SESSION / 01</span>
          <h2>让灵感落在拍子上。</h2>
          <p>从 85 BPM 开始，用四个小节讲一个真实的故事。</p>
          <button className="button dark" onClick={() => go("practice")}>
            进入练习室 <ArrowRight size={18} />
          </button>
        </div>
        <div className="session-type" aria-hidden="true">
          <span>FIND</span>
          <span>
            YOUR <i>FLOW</i>
          </span>
          <small>4 BARS. ONE STORY. YOUR VOICE.</small>
        </div>
      </section>
      <section className="music-section">
        <div className="section-title">
          <h2>
            你的下一首 <span>CURATED PICKS</span>
          </h2>
          <span className="muted">精选歌单 · 按心情匹配</span>
        </div>
        <div className="filters">
          <div className="chips" aria-label="心情筛选">
            {["", "放松", "振奋", "沉思", "自信"].map((m) => (
              <button
                aria-pressed={m === mood}
                className={m === mood ? "chip selected" : "chip"}
                key={m}
                onClick={() => setMood(m)}
              >
                {m || "全部心情"}
              </button>
            ))}
          </div>
          <div className="search-filters">
            <select
              aria-label="音乐风格"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              {[
                "",
                "Boom bap",
                "Jazz rap",
                "Trap",
                "West Coast",
                "Hardcore",
              ].map((s) => (
                <option key={s} value={s}>
                  {s || "全部风格"}
                </option>
              ))}
            </select>
            <input
              aria-label="搜索歌曲或歌手"
              placeholder="搜索歌曲 / 歌手"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        {loading ? (
          <div className="empty">正在找声音…</div>
        ) : error ? (
          <div className="empty error" role="alert">
            {error}
          </div>
        ) : songs.length === 0 ? (
          <div className="empty">还没有匹配的曲目，换个心情或搜索词试试。</div>
        ) : (
          <div className="song-grid">
            {songs.map((s, i) => (
              <article className="song-card" key={s.id}>
                <div className="cover" style={{ background: s.color }}>
                  <span>{s.style.toUpperCase()}</span>
                  <strong>{s.artist}</strong>
                  <div className="cover-bottom">
                    <span>WR SELECTS</span>
                    <span>0{i + 1}</span>
                  </div>
                </div>
                <div className="song-meta">
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.artist}</p>
                  </div>
                  <button
                    className={
                      s.favorite ? "icon-button favorited" : "icon-button"
                    }
                    aria-label={`${s.favorite ? "取消收藏" : "收藏"} ${s.title}`}
                    aria-pressed={s.favorite}
                    disabled={busy === s.id}
                    onClick={async () => {
                      if (!requireLogin()) return;
                      setBusy(s.id);
                      try {
                        await api(`/favorites/${s.id}`, "PUT", {
                          favorite: !s.favorite,
                        });
                        setSongs((old) =>
                          old.map((x) =>
                            x.id === s.id ? { ...x, favorite: !x.favorite } : x,
                          ),
                        );
                      } catch (e) {
                        notify((e as Error).message);
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    <Heart
                      size={19}
                      fill={s.favorite ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <p className="song-reason">{s.reason}</p>
                <a
                  className="listen-link"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  前往收听 <ArrowUpRight size={15} />
                </a>
              </article>
            ))}
          </div>
        )}
      </section>
      <div className="discovery-bottom">
        <span>
          <span className="lime">✦</span> 灵感不止于听见
        </span>
        <button className="text-button" onClick={() => go("write")}>
          打开写词工作台 <ArrowRight size={18} />
        </button>
      </div>
    </>
  );
}
function Auth({
  close,
  success,
}: {
  close: () => void;
  success: (u: User) => void;
}) {
  const [register, setRegister] = useState(false),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="auth-dialog"
      onCancel={(e) => {
        if (busy) e.preventDefault();
        else close();
      }}
    >
      <button
        className="dialog-close"
        aria-label="关闭登录"
        disabled={busy}
        onClick={close}
      >
        ×
      </button>
      <span className="eyebrow">WELCOME TO THE CYPHER</span>
      <h2>{register ? "找到你的舞台" : "欢迎回来"}</h2>
      <p className="muted">登录后保存草稿、收藏音乐，与同好交流。</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const r = await api<{ user: User }>(
              `/auth/${register ? "register" : "login"}`,
              "POST",
              { username, password },
            );
            success(r.user);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          用户名
          <input
            autoFocus
            required
            minLength={2}
            maxLength={24}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          密码
          <input
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={register ? "new-password" : "current-password"}
            placeholder="至少 8 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary full" disabled={busy}>
          {busy ? "请稍候…" : register ? "注册并登录" : "登录"}
        </button>
      </form>
      <button
        className="text-button auth-switch"
        disabled={busy}
        onClick={() => {
          setRegister(!register);
          setError("");
        }}
      >
        {register ? "已有账号？去登录" : "第一次来？创建账号"}{" "}
        <ArrowRight size={16} />
      </button>
    </dialog>
  );
}
function Chat({
  user,
  requireLogin,
  notify,
  aiMode,
}: Shared & { user: User | null; aiMode: string }) {
  const [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(!!user),
    bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (user)
      api<{ messages: Message[] }>("/chat")
        .then((r) => setMessages(r.messages))
        .catch((e) => notify(e.message))
        .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);
  const send = async (value: string) => {
    if (!value.trim() || busy || !requireLogin()) return;
    setBusy(true);
    try {
      const reply = await api<{ content: string; mode: "demo" | "live" }>(
        "/chat",
        "POST",
        { message: value, mode: "chat" },
      );
      setMessages((old) => [
        ...old,
        { role: "user", content: value, mode: reply.mode },
        { role: "assistant", ...reply },
      ]);
      setInput("");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Title
        label="YOUR RAP COMPANION"
        title="有想法，一起聊"
        detail="聊音乐、拆解歌词，或为下一段 Verse 找一个起点。"
      />
      <div className="mode-banner">
        {aiMode === "demo"
          ? "演示模式：提供固定练习提示，尚未连接真实 AI。"
          : "已配置模型：请勿提交密码等敏感信息，模型回复可能有误。"}
      </div>
      <section className="chat-panel">
        <div className="messages" aria-live="polite">
          {loading ? (
            <p className="muted">读取对话中…</p>
          ) : messages.length === 0 ? (
            <div className="chat-welcome">
              <span className="large-icon">
                <Headphones size={32} />
              </span>
              <h2>你的下一句，从这里开始。</h2>
              <p>选一个话题，或直接告诉我你想做什么。</p>
              <div className="suggestions">
                {[
                  "推荐一些适合放松听的 Rap",
                  "怎么练习 Flow？",
                  "帮我理解押韵和 Punchline",
                ].map((s) => (
                  <button key={s} onClick={() => setInput(s)}>
                    {s}
                    <ArrowUpRight size={16} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div className={`message ${m.role}`} key={i}>
                <span className="message-name">
                  {m.role === "user"
                    ? "你"
                    : `WannaRap · ${m.mode === "demo" ? "演示" : "AI"}`}
                </span>
                <p>{m.content}</p>
              </div>
            ))
          )}
          {busy && <p className="muted">正在思考，请稍候…</p>}
          <div ref={bottom} />
        </div>
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <textarea
            aria-label="聊天消息"
            placeholder="聊聊你的灵感…（可粘贴自己的歌词请求反馈）"
            maxLength={4000}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy || loading}
          />
          <button
            className="button primary"
            disabled={busy || loading || !input.trim()}
          >
            <Send size={18} />
            <span>发送</span>
          </button>
        </form>
      </section>
    </>
  );
}
function Writing({
  user,
  requireLogin,
  notify,
  aiMode,
  guard,
}: Shared & {
  user: User | null;
  aiMode: string;
  guard: React.MutableRefObject<() => boolean>;
}) {
  const [draft, setDraft] = useState(""),
    [prompt, setPrompt] = useState(""),
    [result, setResult] = useState(""),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [loading, setLoading] = useState(!!user),
    [saved, setSaved] = useState("");
  useEffect(() => {
    if (user)
      api<{ content: string }>("/draft")
        .then((r) => {
          setDraft(r.content);
          setSaved(r.content);
        })
        .catch((e) => notify(e.message))
        .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    guard.current = () =>
      draft === saved || window.confirm("草稿还未保存，确定离开吗？");
    return () => {
      guard.current = () => true;
    };
  }, [draft, saved, guard]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (draft !== saved) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draft, saved]);
  if (!user)
    return (
      <>
        <Title
          label="THE WRITING ROOM"
          title="把生活，写成 Verse"
          detail="登录后开始写词，草稿会保存在你的个人空间。"
        />
        <div className="empty">
          <button className="button primary" onClick={requireLogin}>
            登录并开始写词
          </button>
        </div>
      </>
    );
  return (
    <>
      <Title
        label="THE WRITING ROOM"
        title="把生活，写成 Verse"
        detail="先写真实的感受。押韵和结构，我们一起打磨。"
      />
      <div className="writing-grid">
        <section className="panel">
          <div className="section-title">
            <h2>我的草稿</h2>
            <span className="muted">{draft.length} / 10000 字</span>
          </div>
          <textarea
            className="draft-area"
            aria-label="歌词草稿"
            disabled={loading}
            placeholder={
              "给这一段一个画面，\n比如凌晨的街道，或还没说出口的话…"
            }
            maxLength={10000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="panel-footer">
            <span className="muted">
              {draft === saved && saved ? "已保存" : "离开前记得保存"}
            </span>
            <button
              className="button primary"
              disabled={saving || loading}
              onClick={async () => {
                if (!requireLogin()) return;
                setSaving(true);
                try {
                  await api("/draft", "PUT", { content: draft });
                  setSaved(draft);
                  notify("草稿已保存");
                } catch (e) {
                  notify((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              <Save size={17} />
              {saving ? "保存中…" : "保存草稿"}
            </button>
          </div>
        </section>
        <section className="panel coach">
          <span className="eyebrow">A LITTLE CREATIVE PUSH</span>
          <h2>给灵感一个方向</h2>
          <label>
            主题或修改要求
            <textarea
              placeholder="例如：关于毕业的四行 Verse，押 ang 韵"
              maxLength={1000}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <p className="muted">
            {aiMode === "demo"
              ? "演示模式返回固定练习模板。"
              : "会结合当前草稿给出创作建议。"}
          </p>
          <button
            className="button secondary full"
            disabled={busy || !prompt.trim()}
            onClick={async () => {
              if (!requireLogin()) return;
              setBusy(true);
              try {
                const r = await api<{ content: string }>("/chat", "POST", {
                  mode: "lyrics",
                  message: `要求：${prompt}\n我的草稿（节选）：${draft.slice(0, 2800)}`,
                });
                setResult(r.content);
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <PenLine size={17} />
            {busy ? "创作中…" : "获取写词建议"}
          </button>
          {result && (
            <div className="writing-result">
              <p>{result}</p>
              <button
                className="text-button"
                disabled={draft.length + result.length + 2 > 10000}
                onClick={() => setDraft((d) => d + (d ? "\n\n" : "") + result)}
              >
                <Plus size={16} />
                追加到草稿
              </button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
function Practice({
  requireLogin,
  notify,
  loadAudio,
}: Shared & { loadAudio: (f?: File) => void }) {
  const [bpm, setBpm] = useState(85),
    [running, setRunning] = useState(false),
    [beat, setBeat] = useState(0),
    [seconds, setSeconds] = useState(0),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [topic, setTopic] = useState(0);
  const context = useRef<AudioContext | null>(null),
    timer = useRef<ReturnType<typeof setInterval> | null>(null),
    started = useRef(0),
    secondsRef = useRef(0);
  const topics = [
    "凌晨的便利店",
    "写给一年前的自己",
    "一张单程车票",
    "城市里的雨",
    "口袋里的梦想",
  ];
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    void context.current?.close();
    context.current = null;
    setRunning(false);
  };
  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      void context.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (!running) return;
    const tick = setInterval(() => {
      const s = Math.min(
        3600,
        Math.floor((Date.now() - started.current) / 1000),
      );
      secondsRef.current = s;
      setSeconds(s);
      if (s >= 3600) stop();
    }, 250);
    return () => clearInterval(tick);
  }, [running]);
  const start = async () => {
    if (!requireLogin()) return;
    try {
      context.current = new AudioContext();
      await context.current.resume();
      setSeconds(0);
      secondsRef.current = 0;
      setSaved(false);
      started.current = Date.now();
      setRunning(true);
      let next = context.current.currentTime,
        index = 0;
      timer.current = setInterval(() => {
        const ctx = context.current;
        if (!ctx) return;
        while (next < ctx.currentTime + 0.1) {
          const osc = ctx.createOscillator(),
            gain = ctx.createGain();
          osc.frequency.value = index % 4 === 0 ? 1000 : 650;
          gain.gain.setValueAtTime(0.16, next);
          gain.gain.exponentialRampToValueAtTime(0.001, next + 0.055);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(next);
          osc.stop(next + 0.06);
          setBeat(index % 4);
          index++;
          next += 60 / bpm;
        }
      }, 25);
    } catch {
      stop();
      notify("无法启动音频，请允许浏览器播放声音后重试");
    }
  };
  return (
    <>
      <Title
        label="SHOW UP. FIND YOUR FLOW."
        title="练习室，麦克风交给你"
        detail="跟拍、换气、自由表达。今天先完成一小段。"
      />
      <div className="practice-grid">
        <section className="panel metronome">
          <div className="section-title">
            <h2>
              <Volume2 size={20} /> 节拍器
            </h2>
            <span className="eyebrow">4 / 4 TIME</span>
          </div>
          <div className="bpm-number">
            {bpm}
            <span>BPM</span>
          </div>
          <input
            aria-label="节拍速度"
            type="range"
            min="60"
            max="160"
            value={bpm}
            disabled={running}
            onChange={(e) => setBpm(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>60 · 慢练</span>
            <span>160 · 挑战</span>
          </div>
          <div className="beat-dots">
            {[0, 1, 2, 3].map((i) => (
              <span className={running && beat === i ? "lit" : ""} key={i}>
                {i + 1}
              </span>
            ))}
          </div>
          <button
            className="button primary"
            onClick={() => (running ? stop() : void start())}
          >
            {running ? <Square size={18} /> : <Play size={18} />}{" "}
            {running ? "结束练习" : "开始练习"}
          </button>
          <div className="practice-time">
            {String(Math.floor(seconds / 60)).padStart(2, "0")}:
            {String(seconds % 60).padStart(2, "0")}
          </div>
          <button
            className="text-button"
            disabled={running || seconds < 5 || saving || saved}
            onClick={async () => {
              if (!requireLogin()) return;
              setSaving(true);
              try {
                await api("/practice", "POST", {
                  bpm,
                  seconds: secondsRef.current,
                });
                setSaved(true);
                notify("练习已记入你的成长记录");
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saved ? <Check size={16} /> : <Save size={16} />}{" "}
            {saved ? "已记录" : "保存本次练习"}
          </button>
          <p className="muted">练习至少 5 秒后可保存；速度在停止时调整。</p>
        </section>
        <div>
          <section className="panel prompt-card">
            <span className="eyebrow">FREESTYLE PROMPT</span>
            <h2>{topics[topic]}</h2>
            <p>用 4 个小节讲一个场景，最后一句留给你的态度。</p>
            <button
              className="text-button"
              onClick={() => setTopic((t) => (t + 1) % topics.length)}
            >
              换个主题 <ArrowRight size={17} />
            </button>
          </section>
          <section className="panel practice-guide">
            <h2>今天的练习顺序</h2>
            <p>
              <b>01</b> 只数拍子，找到 2、4 拍。
            </p>
            <p>
              <b>02</b> 每拍加一个词，保持呼吸。
            </p>
            <p>
              <b>03</b> 连成四句话，给结尾留白。
            </p>
            <label className="button secondary file-button">
              <Upload size={17} />
              播放自己的伴奏
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => loadAudio(e.target.files?.[0])}
              />
            </label>
            <p className="muted">支持本地音频回放；本版不做自动 Flow 评分。</p>
          </section>
        </div>
      </div>
    </>
  );
}
function Community({ requireLogin, notify }: Shared) {
  const [posts, setPosts] = useState<Post[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [compose, setCompose] = useState(false),
    [title, setTitle] = useState(""),
    [content, setContent] = useState(""),
    [kind, setKind] = useState("Verse"),
    [audio, setAudio] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = () =>
    api<{ posts: Post[] }>("/posts")
      .then((r) => {
        setPosts(r.posts);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <>
      <div className="discovery-intro">
        <Title
          label="PASS THE MIC"
          title="你的声音，值得被听见"
          detail="分享 Verse、Demo 和创作心得。给彼此一点具体的鼓励。"
        />
        <button
          className="button primary"
          onClick={() => {
            if (requireLogin()) setCompose(!compose);
          }}
        >
          <Plus size={18} />
          {compose ? "收起编辑" : "发布作品"}
        </button>
      </div>
      {compose && (
        <form
          className="panel post-compose"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api("/posts", "POST", {
                title,
                content,
                kind,
                audio_url: audio,
              });
              setCompose(false);
              setTitle("");
              setContent("");
              setAudio("");
              await refresh();
              notify("作品已发布");
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-row">
            <label>
              作品标题
              <input
                required
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label>
              类型
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {["Verse", "Demo", "心得"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            作品内容
            <textarea
              required
              maxLength={5000}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="写下你的作品，或告诉大家你希望得到哪方面的建议…"
            />
          </label>
          <label>
            音频直链（选填，HTTPS）
            <input
              type="url"
              placeholder="https://…/my-demo.mp3"
              maxLength={1000}
              value={audio}
              onChange={(e) => setAudio(e.target.value)}
            />
          </label>
          <p className="muted">
            分享你拥有权利的作品。文字和链接会对本站访问者公开。
          </p>
          <button className="button primary" disabled={busy}>
            {busy ? "发布中…" : "发布到社区"}
            <ArrowUpRight size={17} />
          </button>
        </form>
      )}
      {loading ? (
        <div className="empty">正在加载作品…</div>
      ) : error ? (
        <div className="empty error">
          {error}
          <button className="text-button" onClick={() => void refresh()}>
            重试
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty community-empty">
          <Mic size={36} />
          <h2>第一支麦，留给你。</h2>
          <p>社区还没有作品。分享一段四行 Verse，开启这场 Cypher。</p>
          <button
            className="button secondary"
            onClick={() => {
              if (requireLogin()) setCompose(true);
            }}
          >
            分享第一段作品
          </button>
        </div>
      ) : (
        <div className="posts">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              requireLogin={requireLogin}
              notify={notify}
              refresh={refresh}
            />
          ))}
        </div>
      )}
    </>
  );
}
function PostCard({
  post: p,
  requireLogin,
  notify,
  refresh,
}: Shared & { post: Post; refresh: () => Promise<void> }) {
  const [comment, setComment] = useState(""),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <article className="panel post">
      <div className="post-author">
        <span className="avatar">{p.username.slice(0, 1)}</span>
        <div>
          <strong>{p.username}</strong>
          <small>{new Date(p.created_at).toLocaleString("zh-CN")}</small>
        </div>
        <span className="tag">{p.kind}</span>
      </div>
      <h2>{p.title}</h2>
      <p className="post-content">{p.content}</p>
      {p.audio_url && (
        <>
          <audio
            controls
            preload="none"
            src={p.audio_url}
            onError={() =>
              notify("音频无法播放：请检查直链是否可访问及格式是否支持")
            }
          />
          <a
            className="listen-link"
            href={p.audio_url}
            target="_blank"
            rel="noreferrer"
          >
            打开音频链接 <ArrowUpRight size={15} />
          </a>
        </>
      )}
      <div className="post-actions">
        <button
          className={p.liked ? "text-button favorited" : "text-button"}
          disabled={busy}
          onClick={async () => {
            if (!requireLogin()) return;
            setBusy(true);
            try {
              await api(`/posts/${p.id}/like`, "PUT", { liked: !p.liked });
              await refresh();
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Heart size={18} fill={p.liked ? "currentColor" : "none"} />
          {p.likes} 喜欢
        </button>
        <button className="text-button" onClick={() => setOpen(!open)}>
          <MessageCircle size={18} />
          {p.comments.length} 条评论
        </button>
      </div>
      {open && (
        <div className="comments">
          {p.comments.map((c) => (
            <p key={c.id}>
              <strong>{c.username}</strong> {c.content}
            </p>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!requireLogin()) return;
              setBusy(true);
              try {
                await api(`/posts/${p.id}/comments`, "POST", {
                  content: comment,
                });
                setComment("");
                await refresh();
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <input
              aria-label="评论内容"
              placeholder="给一点具体的反馈…"
              required
              maxLength={1000}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <button
              className="button secondary"
              disabled={busy || !comment.trim()}
            >
              评论
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
function Profile({
  user,
  go,
  notify,
  logout,
}: {
  user: User | null;
  go: (p: Page) => void;
  notify: (s: string) => void;
  logout: () => void;
}) {
  const [data, setData] = useState<{
      favorites: string[];
      posts: number;
      practice: { count: number; seconds: number };
    } | null>(null),
    [songs, setSongs] = useState<Song[]>([]);
  useEffect(() => {
    if (user)
      Promise.all([
        api<NonNullable<typeof data>>("/profile"),
        api<{ songs: Song[] }>("/songs"),
      ])
        .then(([p, s]) => {
          setData(p);
          setSongs(s.songs.filter((x) => x.favorite));
        })
        .catch((e) => notify(e.message));
  }, []);
  return (
    <>
      <div className="discovery-intro">
        <Title
          label="YOUR JOURNEY"
          title={user?.username || "我的空间"}
          detail="每一次动笔、每一段练习，都算数。"
        />
        <button className="button secondary" onClick={logout}>
          <LogOut size={17} />
          退出登录
        </button>
      </div>
      {data ? (
        <>
          <div className="stats">
            {[
              [data.favorites.length, "收藏歌曲"],
              [data.posts, "发布作品"],
              [data.practice.count, "练习次数"],
              [Math.floor(data.practice.seconds / 60), "练习分钟"],
            ].map(([v, k]) => (
              <div className="panel" key={k}>
                <strong>{v}</strong>
                <p>{k}</p>
              </div>
            ))}
          </div>
          <section className="panel">
            <h2>我的收藏</h2>
            {songs.length ? (
              songs.map((s) => (
                <a
                  className="favorite-row"
                  key={s.id}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Music2 size={20} />
                  <span>
                    {s.title}
                    <small>{s.artist}</small>
                  </span>
                  <ArrowUpRight size={18} />
                </a>
              ))
            ) : (
              <p className="muted">还没有收藏，去发现下一首喜欢的歌。</p>
            )}
            <button className="text-button" onClick={() => go("discover")}>
              继续发现 <ArrowRight size={17} />
            </button>
          </section>
        </>
      ) : (
        <div className="empty">读取成长记录中…</div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import express from "express";
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import { z } from "zod";
import { openDatabase } from "./db.js";
import { songs, recommend } from "./catalog.js";
import { generateReply } from "../agent/service.js";
const scrypt = promisify(scryptCallback),
  now = () => new Date().toISOString();
const text = (n) => z.string().trim().min(1, "请填写内容").max(n, "内容太长");
const hashToken = (t) => createHash("sha256").update(t).digest("hex");
const firstNonEmpty = (...values) =>
  values.find((value) => typeof value === "string" && value.trim())?.trim();
function fail(status, message) {
  return Object.assign(new Error(message), { status });
}
export function createApp(options = {}) {
  const db = openDatabase(
    options.databasePath ||
      process.env.DATABASE_PATH ||
      fileURLToPath(new URL("../database/wannarap.sqlite", import.meta.url)),
  );
  const app = express();
  app.disable("x-powered-by");
  const model =
      options.model ||
      firstNonEmpty(process.env.AI_MODEL, process.env.OPENAI_MODEL) ||
      "gpt-4.1-mini",
    provider =
      options.provider ||
      firstNonEmpty(process.env.AI_PROVIDER) ||
      (model.toLowerCase().startsWith("deepseek") ? "deepseek" : "openai"),
    apiKey =
      options.apiKey !== undefined
        ? options.apiKey
        : firstNonEmpty(
            process.env.AI_API_KEY,
            process.env.DEEPSEEK_API_KEY,
            process.env.OPENAI_API_KEY,
          ),
    apiBaseUrl =
      options.apiBaseUrl ||
      firstNonEmpty(process.env.AI_BASE_URL, process.env.OPENAI_BASE_URL) ||
      (provider === "deepseek"
        ? "https://api.deepseek.com"
        : "https://api.openai.com/v1");
  const secure = process.env.COOKIE_SECURE === "true";
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
    });
    if (req.path.startsWith("/api")) res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("Sec-Fetch-Site") === "cross-site")
        return next(fail(403, "不允许跨站请求"));
      if (req.get("Origin")) {
        try {
          if (new URL(req.get("Origin")).host !== req.get("Host"))
            return next(fail(403, "不允许跨站请求"));
        } catch {
          return next(fail(403, "无效来源"));
        }
      }
      if (!req.is("application/json"))
        return next(fail(415, "请发送 JSON 数据"));
    }
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  app.use((req, res, next) => {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("wr_session="))
      ?.slice(11);
    if (token)
      req.user = db
        .prepare(
          "SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?",
        )
        .get(hashToken(token), Date.now());
    next();
  });
  const auth = (req, res, next) =>
    req.user ? next() : next(fail(401, "请先登录再继续"));
  const limits = new Map();
  const limit = (name, max) => (req, res, next) => {
    const time = Date.now();
    for (const [k, v] of limits) if (v.until < time) limits.delete(k);
    const key = `${name}:${req.user?.id || req.ip}`,
      entry = limits.get(key) || { count: 0, until: time + 60000 };
    limits.set(key, entry);
    if (++entry.count > max)
      return next(fail(429, "操作太频繁，请一分钟后重试"));
    next();
  };
  const credentials = z.object({
    username: text(24)
      .min(2)
      .regex(/^[\p{L}\p{N}_-]+$/u, "用户名只支持文字、数字、下划线和短横线"),
    password: z.string().min(8, "密码至少 8 位").max(128),
  });
  const session = (res, user) => {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires<=?").run(Date.now());
    db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(
      hashToken(token),
      user.id,
      Date.now() + 7 * 86400000,
    );
    res.cookie("wr_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 7 * 86400000,
    });
  };
  app.get("/api/health", (req, res) =>
    res.json({
      ok: true,
      aiMode: apiKey ? "live" : "demo",
      aiProvider: provider,
      aiModel: model,
    }),
  );
  app.get("/api/auth/me", (req, res) => res.json({ user: req.user || null }));
  app.post("/api/auth/register", limit("auth", 10), async (req, res) => {
    const { username, password } = credentials.parse(req.body),
      salt = randomBytes(16).toString("hex");
    const key = await scrypt(password, salt, 64),
      user = { id: randomUUID(), username };
    try {
      db.prepare("INSERT INTO users VALUES (?,?,?,?)").run(
        user.id,
        username,
        `${salt}:${key.toString("hex")}`,
        now(),
      );
    } catch (error) {
      if (
        error.code?.startsWith("ERR_SQLITE") &&
        db.prepare("SELECT id FROM users WHERE username=?").get(username)
      )
        throw fail(409, "用户名已被使用");
      throw error;
    }
    session(res, user);
    res.status(201).json({ user });
  });
  app.post("/api/auth/login", limit("auth", 10), async (req, res) => {
    const { username, password } = credentials.parse(req.body),
      user = db.prepare("SELECT * FROM users WHERE username=?").get(username);
    const [salt, stored] = (
      user?.password_hash || "dummy:" + Buffer.alloc(64).toString("hex")
    ).split(":");
    const key = await scrypt(password, salt, 64);
    if (!timingSafeEqual(key, Buffer.from(stored, "hex")) || !user)
      throw fail(401, "用户名或密码不正确");
    session(res, user);
    res.json({ user: { id: user.id, username: user.username } });
  });
  app.post("/api/auth/logout", (req, res) => {
    const token = (req.headers.cookie || "")
      .split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("wr_session="))
      ?.slice(11);
    if (token)
      db.prepare("DELETE FROM sessions WHERE token=?").run(hashToken(token));
    res.clearCookie("wr_session", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure,
    });
    res.json({ ok: true });
  });
  app.get("/api/songs", (req, res) => {
    const query = z
      .object({
        mood: z.string().max(30).optional(),
        style: z.string().max(30).optional(),
        q: z.string().max(100).optional(),
      })
      .parse(req.query);
    const favorites = req.user
      ? db
          .prepare("SELECT song_id FROM favorites WHERE user_id=?")
          .all(req.user.id)
          .map((r) => r.song_id)
      : [];
    res.json({ songs: recommend(query, favorites) });
  });
  app.put("/api/favorites/:id", auth, (req, res) => {
    if (!songs.some((s) => s.id === req.params.id))
      throw fail(404, "歌曲不存在");
    const { favorite } = z.object({ favorite: z.boolean() }).parse(req.body);
    if (favorite)
      db.prepare("INSERT OR IGNORE INTO favorites VALUES (?,?)").run(
        req.user.id,
        req.params.id,
      );
    else
      db.prepare("DELETE FROM favorites WHERE user_id=? AND song_id=?").run(
        req.user.id,
        req.params.id,
      );
    res.json({ favorite });
  });
  app.get("/api/draft", auth, (req, res) =>
    res.json(
      db
        .prepare("SELECT content,updated_at FROM drafts WHERE user_id=?")
        .get(req.user.id) || { content: "", updated_at: null },
    ),
  );
  app.put("/api/draft", auth, (req, res) => {
    const { content } = z
        .object({ content: z.string().max(10000) })
        .parse(req.body),
      updated_at = now();
    db.prepare(
      "INSERT INTO drafts VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at",
    ).run(req.user.id, content, updated_at);
    res.json({ content, updated_at });
  });
  app.get("/api/chat", auth, (req, res) =>
    res.json({
      messages: db
        .prepare(
          "SELECT role,content,mode FROM (SELECT * FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 60) ORDER BY id",
        )
        .all(req.user.id),
    }),
  );
  const inFlight = new Set();
  app.post("/api/chat", auth, limit("ai", 10), async (req, res) => {
    const { message, mode } = z
      .object({
        message: text(4000),
        mode: z.enum(["chat", "lyrics"]).default("chat"),
      })
      .parse(req.body);
    if (inFlight.has(req.user.id))
      throw fail(409, "上一条消息仍在生成，请稍候");
    inFlight.add(req.user.id);
    try {
      const history =
        mode === "chat"
          ? db
              .prepare(
                "SELECT role,content FROM (SELECT * FROM messages WHERE user_id=? ORDER BY id DESC LIMIT 12) ORDER BY id",
              )
              .all(req.user.id)
          : [];
      let reply;
      try {
        reply = await generateReply({
          messages: [...history, { role: "user", content: message }],
          mode,
          apiKey,
          model,
          apiBaseUrl,
          provider,
          fetchImpl: options.fetchImpl,
        });
      } catch (error) {
        console.error(`AI request failed (${provider}/${model}):`, error.message);
        throw fail(502, error.message);
      }
      if (mode === "chat") {
        db.exec("BEGIN");
        try {
          const insert = db.prepare(
            "INSERT INTO messages(user_id,role,content,mode,created_at) VALUES (?,?,?,?,?)",
          );
          insert.run(req.user.id, "user", message, reply.mode, now());
          insert.run(
            req.user.id,
            "assistant",
            reply.content,
            reply.mode,
            now(),
          );
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      }
      res.json(reply);
    } finally {
      inFlight.delete(req.user.id);
    }
  });
  app.get("/api/posts", (req, res) => {
    const posts = db
      .prepare(
        `SELECT p.*,u.username,(SELECT count(*) FROM likes WHERE post_id=p.id) AS likes,EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=?) AS liked FROM posts p JOIN users u ON p.user_id=u.id ORDER BY p.created_at DESC LIMIT 100`,
      )
      .all(req.user?.id || "");
    for (const p of posts)
      p.comments = db
        .prepare(
          "SELECT c.id,c.content,c.created_at,u.username FROM comments c JOIN users u ON u.id=c.user_id WHERE post_id=? ORDER BY c.created_at LIMIT 100",
        )
        .all(p.id);
    res.json({ posts });
  });
  app.post("/api/posts", auth, limit("write", 30), (req, res) => {
    const p = z
      .object({
        title: text(80),
        content: text(5000),
        kind: z.enum(["Verse", "Demo", "心得"]),
        audio_url: z
          .union([
            z.literal(""),
            z
              .string()
              .url()
              .max(1000)
              .refine(
                (v) => new URL(v).protocol === "https:",
                "音频链接必须使用 HTTPS",
              ),
          ])
          .optional(),
      })
      .parse(req.body);
    const id = randomUUID();
    db.prepare("INSERT INTO posts VALUES (?,?,?,?,?,?,?)").run(
      id,
      req.user.id,
      p.title,
      p.content,
      p.kind,
      p.audio_url || null,
      now(),
    );
    res.status(201).json({ id });
  });
  const postExists = (id) => {
    if (!db.prepare("SELECT id FROM posts WHERE id=?").get(id))
      throw fail(404, "作品不存在");
  };
  app.put("/api/posts/:id/like", auth, (req, res) => {
    postExists(req.params.id);
    const { liked } = z.object({ liked: z.boolean() }).parse(req.body);
    if (liked)
      db.prepare("INSERT OR IGNORE INTO likes VALUES (?,?)").run(
        req.user.id,
        req.params.id,
      );
    else
      db.prepare("DELETE FROM likes WHERE user_id=? AND post_id=?").run(
        req.user.id,
        req.params.id,
      );
    res.json({ liked });
  });
  app.post("/api/posts/:id/comments", auth, limit("write", 30), (req, res) => {
    postExists(req.params.id);
    const { content } = z.object({ content: text(1000) }).parse(req.body);
    db.prepare("INSERT INTO comments VALUES (?,?,?,?,?)").run(
      randomUUID(),
      req.user.id,
      req.params.id,
      content,
      now(),
    );
    res.status(201).json({ ok: true });
  });
  app.post("/api/practice", auth, limit("write", 30), (req, res) => {
    const { bpm, seconds } = z
      .object({
        bpm: z.number().int().min(60).max(160),
        seconds: z.number().int().min(5).max(3600),
      })
      .parse(req.body);
    db.prepare("INSERT INTO practices VALUES (?,?,?,?,?)").run(
      randomUUID(),
      req.user.id,
      bpm,
      seconds,
      now(),
    );
    res.status(201).json({ ok: true });
  });
  app.get("/api/profile", auth, (req, res) =>
    res.json({
      user: req.user,
      favorites: db
        .prepare("SELECT song_id FROM favorites WHERE user_id=?")
        .all(req.user.id)
        .map((r) => r.song_id),
      posts: db
        .prepare("SELECT count(*) AS count FROM posts WHERE user_id=?")
        .get(req.user.id).count,
      practice: db
        .prepare(
          "SELECT count(*) AS count,coalesce(sum(seconds),0) AS seconds FROM practices WHERE user_id=?",
        )
        .get(req.user.id),
    }),
  );
  app.use("/api", (req, res) => res.status(404).json({ error: "接口不存在" }));
  const dist = resolve(
    fileURLToPath(new URL("../frontend/dist", import.meta.url)),
  );
  if (existsSync(dist)) {
    app.use(express.static(dist));
    app.get("/{*path}", (req, res) =>
      res.sendFile(resolve(dist, "index.html")),
    );
  }
  app.use((error, req, res, next) => {
    if (error instanceof z.ZodError)
      return res.status(400).json({ error: error.issues[0].message });
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "提交内容太大" });
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "JSON 格式不正确" });
    if (!error.status) console.error("Request failed:", error.message);
    res
      .status(error.status || 500)
      .json({
        error: error.status ? error.message : "服务出现问题，请稍后再试",
      });
  });
  return { app, db };
}

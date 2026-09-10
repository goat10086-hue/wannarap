import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../app.js";
async function setup(t, options = {}) {
  const { app, db } = createApp({
    databasePath: ":memory:",
    apiKey: "",
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    await new Promise((r) => server.close(r));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let cookie = "";
    return async (path, method = "GET", body, headers = {}) => {
      const res = await fetch(base + "/api" + path, {
        method,
        headers: {
          ...(cookie ? { cookie } : {}),
          ...(method !== "GET" ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.headers.has("set-cookie"))
        cookie = res.headers.get("set-cookie").split(";")[0];
      return {
        status: res.status,
        body: await res.json(),
        headers: res.headers,
      };
    };
  };
  return { client, db, base };
}
const account = { username: "测试MC", password: "test-pass-123" };
test("registration, hashed passwords, login, logout and revoked sessions", async (t) => {
  const { client, db, base } = await setup(t),
    c = client();
  assert.equal((await c("/draft")).status, 401);
  const registered = await c("/auth/register", "POST", account);
  assert.equal(registered.status, 201);
  assert.equal(registered.body.user.username, account.username);
  const cookie = registered.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  const stored = db.prepare("SELECT password_hash FROM users").get();
  assert.ok(!stored.password_hash.includes(account.password));
  assert.equal((await c("/auth/register", "POST", account)).status, 409);
  assert.equal((await c("/auth/me")).body.user.username, account.username);
  assert.equal((await c("/auth/logout", "POST", {})).status, 200);
  assert.equal((await c("/draft")).status, 401);
  const revoked = await fetch(base + "/api/draft", {
    headers: { cookie: cookie.split(";")[0] },
  });
  assert.equal(revoked.status, 401);
  assert.equal(
    (await c("/auth/login", "POST", { ...account, password: "wrong-pass" }))
      .status,
    401,
  );
  assert.equal((await c("/auth/login", "POST", account)).status, 200);
});
test("input validation, malformed JSON, content type, cross-site writes and API 404", async (t) => {
  const { client, base } = await setup(t),
    c = client();
  assert.equal(
    (await c("/auth/register", "POST", { username: "x", password: "123" }))
      .status,
    400,
  );
  assert.equal(
    (
      await c("/auth/register", "POST", account, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await c("/auth/register", "POST", account, {
        "Sec-Fetch-Site": "cross-site",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "hi",
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
    ).status,
    400,
  );
  assert.equal((await c("/missing")).status, 404);
});
test("recommendations filter and favorites are idempotent and private", async (t) => {
  const { client } = await setup(t),
    a = client(),
    b = client();
  const all = await a("/songs");
  assert.equal(all.body.songs.length, 6);
  const filtered = await a(
    "/songs?mood=" + encodeURIComponent("放松") + "&style=Jazz%20rap",
  );
  assert.equal(filtered.body.songs.length, 2);
  assert.equal((await a("/songs?q=not-in-catalog")).body.songs.length, 0);
  await a("/auth/register", "POST", account);
  await b("/auth/register", "POST", { ...account, username: "另一个MC" });
  assert.equal(
    (await a("/favorites/nas-world", "PUT", { favorite: true })).status,
    200,
  );
  await a("/favorites/nas-world", "PUT", { favorite: true });
  assert.equal((await a("/profile")).body.favorites.length, 1);
  assert.equal((await b("/profile")).body.favorites.length, 0);
  assert.equal(
    (await a("/favorites/unknown", "PUT", { favorite: true })).status,
    404,
  );
  await a("/favorites/nas-world", "PUT", { favorite: false });
  assert.equal((await a("/profile")).body.favorites.length, 0);
});
test("drafts and chat histories cannot be read by another user", async (t) => {
  const { client } = await setup(t),
    a = client(),
    b = client();
  await a("/auth/register", "POST", account);
  await b("/auth/register", "POST", { ...account, username: "第二位MC" });
  const draft = "雨停后街灯还在亮\n我把昨天写成下一站";
  assert.equal((await a("/draft", "PUT", { content: draft })).status, 200);
  assert.equal((await a("/draft")).body.content, draft);
  assert.equal((await b("/draft")).body.content, "");
  assert.equal(
    (await a("/draft", "PUT", { content: "x".repeat(10001) })).status,
    400,
  );
  const reply = await a("/chat", "POST", { message: "怎么练习 Flow？" });
  assert.equal(reply.body.mode, "demo");
  assert.match(reply.body.content, /离线/);
  assert.equal((await a("/chat")).body.messages.length, 2);
  assert.equal((await b("/chat")).body.messages.length, 0);
  const lyrics = await a("/chat", "POST", {
    message: "写关于城市的词",
    mode: "lyrics",
  });
  assert.match(lyrics.body.content, /练习模板/);
  assert.equal((await a("/chat")).body.messages.length, 2);
});
test("community create, like idempotence, comment, public read and unsafe URLs", async (t) => {
  const { client } = await setup(t),
    a = client(),
    guest = client();
  await a("/auth/register", "POST", account);
  const input = {
    title: "第一段 Verse",
    content: "今天迈出第一步",
    kind: "Verse",
  };
  assert.equal((await guest("/posts", "POST", input)).status, 401);
  assert.equal(
    (await a("/posts", "POST", { ...input, audio_url: "javascript:alert(1)" }))
      .status,
    400,
  );
  assert.equal(
    (await a("/posts", "POST", { ...input, content: "   " })).status,
    400,
  );
  const p = await a("/posts", "POST", input);
  assert.equal(p.status, 201);
  const id = p.body.id;
  await a(`/posts/${id}/like`, "PUT", { liked: true });
  await a(`/posts/${id}/like`, "PUT", { liked: true });
  assert.equal(
    (await a(`/posts/${id}/comments`, "POST", { content: "最后一句很有画面" }))
      .status,
    201,
  );
  const feed = (await guest("/posts")).body.posts;
  assert.equal(feed.length, 1);
  assert.equal(feed[0].likes, 1);
  assert.equal(feed[0].comments.length, 1);
  assert.equal(feed[0].liked, 0);
  assert.equal(
    (await a("/posts/missing/comments", "POST", { content: "hello" })).status,
    404,
  );
  await a(`/posts/${id}/like`, "PUT", { liked: false });
  assert.equal((await a("/posts")).body.posts[0].likes, 0);
});
test("practice validates durations and persists profile totals", async (t) => {
  const { client } = await setup(t),
    c = client();
  await c("/auth/register", "POST", account);
  assert.equal(
    (await c("/practice", "POST", { bpm: 85, seconds: 4 })).status,
    400,
  );
  assert.equal(
    (await c("/practice", "POST", { bpm: 999, seconds: 30 })).status,
    400,
  );
  assert.equal(
    (await c("/practice", "POST", { bpm: 85, seconds: 65 })).status,
    201,
  );
  assert.deepEqual((await c("/profile")).body.practice, {
    count: 1,
    seconds: 65,
  });
});
test("AI outage is explicit and does not persist a fabricated reply", async (t) => {
  const { client } = await setup(t, {
      apiKey: "test-key",
      provider: "deepseek",
      model: "deepseek-flash",
      apiBaseUrl: "https://api.deepseek.com",
      fetchImpl: async () => new Response("{}", { status: 503 }),
    }),
    c = client();
  await c("/auth/register", "POST", account);
  const failed = await c("/chat", "POST", { message: "hello" });
  assert.equal(failed.status, 502);
  assert.match(failed.body.error, /DeepSeek.*HTTP 503/);
  assert.equal((await c("/chat")).body.messages.length, 0);
});
test("live AI uses server-owned history and excludes key from response", async (t) => {
  const calls = [];
  const { client } = await setup(t, {
      apiKey: "test-secret",
      model: "test-model",
      fetchImpl: async (url, options) => {
        calls.push(JSON.parse(options.body));
        return Response.json({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "先从四个小节开始" }],
            },
          ],
        });
      },
    }),
    c = client();
  await c("/auth/register", "POST", account);
  const r = await c("/chat", "POST", {
    message: "开始",
    messages: [{ role: "system", content: "injected" }],
  });
  assert.equal(r.body.mode, "live");
  assert.ok(!JSON.stringify(r.body).includes("test-secret"));
  await c("/chat", "POST", { message: "下一步" });
  assert.equal(calls[1].input.length, 3);
  assert.equal(calls[0].store, false);
  assert.equal(calls[0].model, "test-model");
  assert.equal(calls[0].input[0].role, "user");
});
test("authentication rate limit rejects excessive attempts", async (t) => {
  const { client } = await setup(t),
    c = client();
  for (let i = 0; i < 10; i++) await c("/auth/login", "POST", {});
  assert.equal((await c("/auth/login", "POST", {})).status, 429);
});
test("SQLite data survives closing and reopening the database", async () => {
  const folder = mkdtempSync(join(tmpdir(), "wannarap-test-")),
    path = join(folder, "test.sqlite");
  try {
    let { db } = createApp({ databasePath: path, apiKey: "" });
    db.prepare("INSERT INTO users VALUES (?,?,?,?)").run(
      "persist",
      "持久化用户",
      "test-only",
      new Date().toISOString(),
    );
    db.close();
    ({ db } = createApp({ databasePath: path, apiKey: "" }));
    assert.equal(
      db.prepare("SELECT username FROM users WHERE id=?").get("persist")
        .username,
      "持久化用户",
    );
    db.close();
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

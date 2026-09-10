import { test } from "node:test";
import assert from "node:assert/strict";
import { generateReply } from "../../agent/service.js";
test("offline mode never calls external AI", async () => {
  const reply = await generateReply({
    messages: [{ role: "user", content: "推荐音乐" }],
    fetchImpl: () => {
      throw new Error("Unexpected network");
    },
  });
  assert.equal(reply.mode, "demo");
  assert.match(reply.content, /离线推荐/);
});
test("response parser collects text after reasoning and rejects empty output", async () => {
  const base = {
    apiKey: "test",
    model: "test",
    messages: [{ role: "user", content: "hi" }],
  };
  const r = await generateReply({
    ...base,
    fetchImpl: async () =>
      Response.json({
        output: [
          { type: "reasoning" },
          {
            content: [
              { type: "output_text", text: "第一行" },
              { type: "output_text", text: "第二行" },
            ],
          },
        ],
      }),
  });
  assert.equal(r.content, "第一行\n第二行");
  await assert.rejects(
    generateReply({
      ...base,
      fetchImpl: async () => Response.json({ output: [] }),
    }),
    /未返回文本/,
  );
});
test("DeepSeek requests use its Responses API endpoint", async () => {
  let requestedUrl;
  const reply = await generateReply({
    apiKey: "test-key",
    model: "deepseek-flash",
    provider: "deepseek",
    apiBaseUrl: "https://api.deepseek.com",
    messages: [{ role: "user", content: "给我一个练习建议" }],
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return Response.json({
        output: [
          {
            content: [{ type: "output_text", text: "先写四个小节。" }],
          },
        ],
      });
    },
  });
  assert.equal(requestedUrl, "https://api.deepseek.com/responses");
  assert.equal(reply.mode, "live");
});
test("DeepSeek authentication failures give an actionable message", async () => {
  await assert.rejects(
    generateReply({
      apiKey: "expired-key",
      model: "deepseek-flash",
      provider: "deepseek",
      apiBaseUrl: "https://api.deepseek.com",
      messages: [{ role: "user", content: "hello" }],
      fetchImpl: async () => new Response("{}", { status: 401 }),
    }),
    /DeepSeek：API 密钥无效或已过期（HTTP 401）/,
  );
});

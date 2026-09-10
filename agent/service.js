export function demoReply(message, mode) {
  if (mode === "lyrics")
    return `【离线写词练习模板】\n主题：${message.slice(0, 100)}\n\n先用「ang」韵写四个落点：光 / 方向 / 回响 / 远方。\n把路灯下的影子，写成还没熄灭的光\n把口袋里的犹豫，换成下一站的方向\n让鞋底踩过的雨水，留下自己的回响\n这一段由你接笔，写下你想去的远方\n\n这是固定练习示例。试着替换成你亲历的场景；每行标出一次换气，再用 85 BPM 读出来。`;
  if (/推荐|听|歌曲/.test(message))
    return "【离线推荐提示】\n去「发现音乐」选择心情与风格，可以筛选精选曲目。放松时可从 Jazz rap 开始。每首卡片包含练习方向与外部收听入口。这是规则回复；连接模型后可讨论你的具体偏好。";
  if (/押韵|词|verse/i.test(message))
    return "【离线创作提示】\n先写一个真实场景，再挑一句作为结尾。试用「光 / 方向 / 回响」串起四行，把重音放在每小节第 2、4 拍附近。去「写词工作台」保存草稿。演示模式不会分析你提供的歌词。";
  return "【离线练习提示】\n从一段 4 小节练习开始：设为 85 BPM，先数 1、2、3、4，再每拍说一个词，最后连成一句话。\n我目前运行在演示模式，提供固定练习提示。配置模型后可进行多轮聊天、歌词解析和写词反馈。";
}
export async function generateReply({
  messages,
  mode = "chat",
  apiKey,
  model,
  apiBaseUrl = "https://api.openai.com/v1",
  provider = "openai",
  fetchImpl = fetch,
}) {
  if (!apiKey)
    return { content: demoReply(messages.at(-1).content, mode), mode: "demo" };
  let endpoint;
  try {
    endpoint = new URL(`${apiBaseUrl.replace(/\/+$/, "")}/responses`);
    if (!["https:", "http:"].includes(endpoint.protocol))
      throw new Error("unsupported protocol");
  } catch {
    throw new Error("模型接口地址无效，请检查 AI_BASE_URL。");
  }
  const response = await fetchImpl(endpoint, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 1400,
      instructions: `你是 WannaRap 的中文 Rap 创作教练。提供具体、友善、可练习的建议。当前任务：${mode === "lyrics" ? "根据用户主题、草稿和要求辅助创作原创歌词" : "Rap 问答、文化讲解和歌词解析"}。不要声称听过用户音频或已经分析节拍。不要编造曲目或可播放链接。讨论用户自己的文本时可逐句分析；涉及商业歌曲时用简短引用和概括。`,
      input: messages.map(({ role, content }) => ({ role, content })),
    }),
  });
  if (!response.ok) {
    const service = provider === "deepseek" ? "DeepSeek" : "模型服务";
    const reason =
      response.status === 401
        ? "API 密钥无效或已过期"
        : response.status === 402
          ? "账户余额不足"
          : response.status === 403
            ? "当前账号无权调用该模型"
            : response.status === 404
              ? "接口地址或模型名称不正确"
              : response.status === 429
                ? "请求过于频繁，请稍后重试"
                : "服务暂时不可用，请稍后重试";
    throw new Error(`${service}：${reason}（HTTP ${response.status}）`);
  }
  const body = await response.json();
  const content = body.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("\n");
  if (!content) throw new Error("模型未返回文本，请稍后重试。");
  return { content, mode: "live" };
}

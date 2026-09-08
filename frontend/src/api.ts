export type User = { id: string; username: string };
export type Song = {
  id: string;
  title: string;
  artist: string;
  style: string;
  mood: string;
  color: string;
  reason: string;
  url: string;
  favorite: boolean;
};
export type Message = {
  role: "user" | "assistant";
  content: string;
  mode: "demo" | "live";
};
export type Post = {
  id: string;
  username: string;
  title: string;
  content: string;
  kind: string;
  audio_url: string | null;
  created_at: string;
  likes: number;
  liked: number;
  comments: { id: string; username: string; content: string }[];
};
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: "same-origin",
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "请求失败，请重试");
  return result;
}

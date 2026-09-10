# 🎤 WannaRap · 想要说唱

An AI-powered Hip-Hop Companion.

面向 Rap 爱好者的音乐发现、写词、练习和作品交流社区。已在原有仓库目录和产品定义上补齐可本地运行的 MVP，保留原 Git 历史。

## 快速启动

需要 Node.js 22.17+。

```sh
npm install
npm run dev
```

打开 http://127.0.0.1:3001 ，创建自己的账号开始使用。修改前端后自动重新构建，完成后刷新浏览器；修改后端自动重启。

构建后运行：

```sh
npm run build
npm start
```

打开 http://127.0.0.1:3001 。Windows 可使用 `npm.cmd` 避免 PowerShell 脚本执行策略问题。

## 当前功能

- 用户注册、登录、退出和个人空间。
- 精选 Rap 歌曲搜索、按心情/风格筛选、收藏、外部收听入口。
- AI 聊天与历史记录；歌词辅助创作和私有草稿保存。
- 可调节拍器、Freestyle 主题、计时和练习记录。
- 本地音频播放器，文件不上传。
- 社区作品发布、HTTPS 音频链接分享、点赞和评论。

AI 支持 DeepSeek Responses API 和 OpenAI Responses API；密钥留空时明确使用离线演示模板。歌曲推荐是人工精选与规则筛选；商业音乐通过外部平台收听。本版不包含音频上传、录音或自动 Flow 评分。

## 文档

- [详细启动、AI 配置与验收步骤](docs/START.md)
- [原仓库分析、实施范围和后续工作](docs/MVP-implementation.md)
- [产品定义](docs/Product.md)
- [原始 README 与路线规划存档](docs/README-original.md)

## 目录

```text
frontend/     React + TypeScript + Vite 页面
backend/      Express API 与集成测试
agent/        AI 服务和离线演示回复
database/     SQLite 表结构和本地数据（数据不提交）
docs/         产品文档与开发记录
design/       原设计目录
assets/       原资源目录
```

原文档中的 NestJS/PostgreSQL 为后续技术规划，当前 MVP 用 Express/SQLite 降低本地启动成本。

## 验证

```sh
npm run check
npm test
npm run build
```

`.env`、本地数据库、依赖和构建结果已加入 Git 忽略规则。不要将 API 密钥提交到仓库。

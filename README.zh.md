# rad-joplin

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Pi Agent 的 Joplin 扩展工具。

通过 Joplin Web Clipper API 读写 Joplin 笔记，无需 MCP。

## 环境要求

- Node.js >= 22.19.0
- [pi](https://pi.dev) Agent
- Joplin 桌面版（需启用 Web Clipper）

## 安装

```bash
# 获取 token：Joplin → 设置 → Web Clipper → 复制 Token
export JOPLIN_TOKEN=your-token

# 安装
pi install git:github.com/dreanzy/pi_rad_joplin

# 重启 pi
/reload
```

## 工具列表

| 工具                  | 说明                    |
| --------------------- | ----------------------- |
| `joplin_list_folders` | 列出所有笔记本          |
| `joplin_list_notes`   | 浏览笔记                |
| `joplin_get_note`     | 读取笔记内容            |
| `joplin_create_note`  | 创建新笔记              |
| `joplin_update_note`  | 更新笔记                |
| `joplin_delete_note`  | ⚠️ 删除笔记（不可恢复） |
| `joplin_search`       | 全文搜索                |

## 开发

```bash
git clone https://github.com/dreanzy/pi_rad_joplin.git
cd pi_rad_joplin
npm ci
npm test              # 运行测试
npm run typecheck     # 类型检查

# 本地安装到 pi
pi install "$(pwd)"
```

# rad-joplin

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

Joplin extension tools for [pi](https://pi.dev) Agent.

Read/write Joplin notes via the Web Clipper REST API — no MCP needed.

## Requirements

- Node.js >= 22.19.0
- [pi](https://pi.dev) Agent
- Joplin desktop (Web Clipper must be enabled)

## Installation

```bash
# Get your token from Joplin → Settings → Web Clipper → Copy Token
export JOPLIN_TOKEN=your-token

# Install rad-joplin
pi install git:github.com/dreanzy/pi_rad_joplin

# Restart pi
/reload
```

## Tools

| Tool                  | Description                   |
| --------------------- | ----------------------------- |
| `joplin_list_folders` | List all Joplin notebooks     |
| `joplin_list_notes`   | Browse notes by notebook      |
| `joplin_get_note`     | Read note content             |
| `joplin_create_note`  | Create new note               |
| `joplin_update_note`  | Update existing note          |
| `joplin_delete_note`  | ⚠️ Delete note (irreversible) |
| `joplin_search`       | Full-text search              |

All tools communicate with Joplin via its Web Clipper REST API.

## Development

```bash
git clone https://github.com/dreanzy/pi_rad_joplin.git
cd pi_rad_joplin
npm ci
npm test              # run tests
npm run typecheck     # type check

# Install locally to pi
pi install "$(pwd)"
```

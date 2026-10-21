<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repository skills and Cloud portability

- The UI/UX skill used by this project is vendored at `.agents/skills/ui-ux-pro-max/SKILL.md`, with its data, scripts and references. Read it for UI work. Do not refer to a Windows user's personal skill directory.
- Existing visual decisions are in `design-system/hesabim/MASTER.md`; preserve them unless the requested change calls for a redesign.
- See `docs/CODEX_CLOUD.md` for Cloud setup and MCP verification. MCP tools are available only when the current task actually exposes them; copying a configuration file does not prove a connection is active.
- Do not transfer personal Codex config, OAuth caches, API keys, database credentials, or unrelated company integrations into this repository.

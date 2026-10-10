#!/usr/bin/env bash
# Wire DevRelay into this repo only (see docs/DEVRELAY_SETUP.md, step 2).
set -euo pipefail

cd "$(dirname "$0")/.."
repo="$PWD"
skills="$repo/.claude/skills"
bin="$HOME/.devrelay/bin"

[ -x "$bin/devrelay" ] || { echo "DevRelay isn't installed. Follow step 1 of docs/DEVRELAY_SETUP.md first." >&2; exit 1; }

# 1. MCP server at local scope, so only sessions started in this directory see it.
if claude mcp get devrelay-gateway >/dev/null 2>&1; then
  echo "1/3 devrelay-gateway already registered for this repo"
else
  claude mcp add devrelay-gateway --scope local \
    --env DEVRELAY_SKILLS_DIR="$skills" \
    -- "$bin/dev_mlh_mcp_server" --stdio
  echo "1/3 registered devrelay-gateway (local scope)"
fi

# 2. Skills into this repo only. Run from an empty folder: inside a git repo the sync also writes .agents/AGENTS.md.
mkdir -p "$skills"
(cd "$(mktemp -d)" && DEVRELAY_SKILLS_DIR="$skills" "$bin/devrelay" --sync-skills)
echo "2/3 synced skills into .claude/skills"

# 3. Agent rules, minus any bullets meant for DevRelay's own repository.
curl -fsSL https://devrelay.com/v1/skills.json | node -e '
  const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const parts = j.agents_rules.content.split(/\n(?=- \*\*)/);
  const keep = parts.filter((p, i) => i === 0 || !/stdout|documentation|docs\/|version tag/i.test(p.match(/^- \*\*([^*]+)\*\*/)?.[1] ?? ""));
  const header = `<!-- DevRelay agent rules from devrelay.com/v1/skills.json (manifest ${j.version}). Bullets about maintaining DevRelay itself are removed. -->\n`;
  require("fs").writeFileSync(".claude/devrelay-rules.md", header + keep.join("\n").trimEnd() + "\n");
'
echo "3/3 wrote .claude/devrelay-rules.md"

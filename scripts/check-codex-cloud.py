#!/usr/bin/env python3
"""Offline readiness check. Does not connect MCP servers or read credentials."""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKILL = ROOT / ".agents" / "skills" / "ui-ux-pro-max"


def main():
    required = [
        SKILL / "SKILL.md",
        SKILL / "references" / "quick-reference.md",
        SKILL / "references" / "pro-rules.md",
        SKILL / "scripts" / "search.py",
        SKILL / "scripts" / "core.py",
        SKILL / "scripts" / "design_system.py",
        SKILL / "scripts" / "reasoning_contract.py",
        SKILL / "data" / "styles.csv",
        SKILL / "data" / "ux-guidelines.csv",
        SKILL / "data" / "stacks" / "nextjs.csv",
        ROOT / ".codex" / "mcp.cloud.toml.example",
    ]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
    if missing:
        raise RuntimeError("Missing resources: " + ", ".join(missing))

    instructions = (SKILL / "SKILL.md").read_text(encoding="utf-8")
    if not instructions.startswith("---\n") or "name: ui-ux-pro-max" not in instructions:
        raise RuntimeError("Invalid skill identity/frontmatter")
    if "CLAUDE_PLUGIN_ROOT" in instructions or "C:\\Users\\" in instructions:
        raise RuntimeError("Skill instructions still depend on a personal installation")

    # Resolve resources from the script, not the caller's current directory.
    searches = [
        ["keyboard focus modal", "--domain", "ux"],
        ["responsive forms", "--stack", "nextjs"],
        ["analytics dashboard", "--design-system", "-p", "Cloud readiness"],
    ]
    for query in searches:
        result = subprocess.run(
            [sys.executable, "-B", str(SKILL / "scripts" / "search.py"), *query, "--json"],
            cwd=ROOT.parent, capture_output=True, text=True, encoding="utf-8", timeout=60,
        )
        if result.returncode:
            raise RuntimeError("Skill search failed: " + result.stderr[:500])
        data = json.loads(result.stdout)
        if "--design-system" in query:
            if not isinstance(data, dict) or not data or data.get("error"):
                raise RuntimeError("Design-system generation returned no usable result")
        elif data.get("error") or data.get("count", 0) < 1:
            raise RuntimeError("Search did not return a verified result: " + query[0])
        print("OK: " + query[0])

    # TOML parsing is available in Python >=3.11; older Python still runs the skill.
    if sys.version_info >= (3, 11):
        import tomllib
        config = tomllib.loads((ROOT / ".codex" / "mcp.cloud.toml.example").read_text(encoding="utf-8"))
        servers = config["mcp_servers"]
        if servers["21st"].get("env_http_headers") != {"x-api-key": "TWENTY_FIRST_API_KEY"}:
            raise RuntimeError("21st must use an environment-backed credential")
        for name, server in servers.items():
            if server.get("http_headers") or server.get("env"):
                raise RuntimeError("Do not inline credential values in " + name)
        print("OK: credential-free MCP example parses")
    else:
        print("NOTE: Python 3.11+ is needed for the optional TOML syntax check")

    print("READY: repository skill resources and offline searches")
    print("NOT VERIFIED: Cloud publication, MCP tool loading, network access and authentication")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as error:
        print("FAILED: " + str(error), file=sys.stderr)
        sys.exit(1)

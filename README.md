<!-- === MODULE_CONTRACT ===
FILE: README.md
VERSION: 1.0.0
PURPOSE: Present MAGRA as the primary product while preserving upstream Reasonix attribution and compatibility notes.
SCOPE: Top-level product overview, install guidance, command usage, web chat workflows, release links, and attribution.
DEPENDS: M-REASONIX-BASE,M-MAGRA-RUNTIME-IDENTITY,M-MYGRACE-SKILLS,M-RTK-SHELL-POLICY,M-SNARC-MEMORY
LINKS: docs/plans/Phase-11.xml
ROLE: RELEASE
MAP_MODE: DOCUMENT
START_MODULE_CONTRACT
END_MODULE_CONTRACT
=== END_MODULE_CONTRACT === -->

<!-- === MODULE_MAP ===
Sections: MAGRA overview, install, command surface, web interface, configuration, documentation, attribution
=== END_MODULE_MAP === -->

<!-- === CHANGE_SUMMARY ===
Initial MAGRA top-level documentation identity with upstream Reasonix attribution.
Added Phase-10 governance metadata so release surface drift is linted.
Rewrote Phase-11 release surface so README is MAGRA-first and keeps Reasonix only as upstream/compatibility context.
Added Phase-14 GitHub one-command installer and v0.1.0 release metadata.
Updated pinned install guidance for the v0.1.1 MyGRACE skill asset hotfix.
Updated pinned install guidance for the v0.1.2 MyGRACE web dispatch hotfix.
Updated pinned install guidance for the v0.1.5 oversized image-preview hotfix release.
Updated pinned install guidance for the v0.1.6 image attachment submit hotfix release.
Updated pinned install guidance for the v0.1.7 image capability gate hotfix release.
Updated pinned install guidance for the v0.1.8 RTK dashboard savings telemetry release.
=== END_CHANGE_SUMMARY === -->

# MAGRA

MAGRA is a local-first AI coding agent for pet projects and serious experiments. It combines the Reasonix base runtime with MyGRACE methodology, RTK token-optimized shell execution, SNARC SQLite memory, native/MCP tools, and a web chat surface where MyGRACE skills are easy to call.

`magra` is the primary command. `reasonix` and `dsnix` remain compatibility aliases for existing automation and upstream migration paths.

<p align="center">
  <img src="docs/logo.svg" alt="MAGRA" width="640"/>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/magra"><img src="https://img.shields.io/npm/v/magra.svg?style=flat-square&color=cb3837&labelColor=161b22&logo=npm&logoColor=white" alt="npm version"/></a>
  <a href="https://github.com/anyagixx/MAGRA/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/anyagixx/MAGRA/ci.yml?style=flat-square&label=ci&labelColor=161b22&logo=githubactions&logoColor=white" alt="CI"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/magra.svg?style=flat-square&color=8b949e&labelColor=161b22" alt="license"/></a>
  <a href="./package.json"><img src="https://img.shields.io/node/v/magra.svg?style=flat-square&color=5fa04e&labelColor=161b22&logo=nodedotjs&logoColor=white" alt="node"/></a>
</p>

## What MAGRA Gives You

- MyGRACE governance: index-first module, phase, verification, and contract navigation.
- Web chat MyGRACE skills: type `/mygrace:` in the dashboard composer to invoke methodology workflows.
- RTK shell integration: eligible shell commands run through `rtk` for lower token output.
- SNARC memory: salience-gated SQLite memory for facts, patterns, and project context.
- Reasonix-compatible runtime: the cache-first DeepSeek loop, MCP support, tools, sessions, hooks, and skills remain available.

## Install

Requires Node 22 or newer, git, and npm. Works on macOS, Linux, and Windows terminals with Bash.

Install directly from the MAGRA GitHub repository:

```bash
curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash
```

Install a pinned release:

```bash
MAGRA_REF=v0.1.8 curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash
```

The installer clones or updates MAGRA in `~/.magra/repo`, builds it, and creates a local `magra` shim in `~/.local/bin`. It does not use `sudo`.

For npm installs after the package is published:

```bash
npm install -g magra
magra code my-project
```

Or run from npm without a global install:

```bash
cd my-project
npx magra@latest code
```

Grab a DeepSeek API key from <https://platform.deepseek.com/api_keys>. Run `magra code --help` for flags.

Compatibility aliases are still shipped:

```bash
reasonix code my-project  # compatibility alias
dsnix code my-project     # short compatibility alias
```

## Commands

| Command | Use |
|---|---|
| `magra` / `magra code [dir]` | Coding agent with filesystem, shell, MCP, MyGRACE, and SNARC tools. |
| `magra chat` | Tool-light chat mode. |
| `magra run "task"` | One-shot task runner for scripts and pipes. |
| `magra doctor` | Health check for Node, API key, dashboard, RTK, and SNARC. |
| `magra stats` | Usage and cost dashboard. |
| `magra mcp ...` | MCP server inspection and management. |

## Web Interface

Start `magra code`, open the dashboard URL printed by the CLI, and use the chat composer as the main operator surface.

- `/mygrace:status` reads only MyGRACE index files.
- `/mygrace:execute` continues the first pending phase.
- `/mygrace:reviewer` audits graph, plan, verification, and contract drift.
- `/mygrace:ask ...` answers architecture questions by lazy-loading only relevant modules.
- Native tools expose `mygrace_*` and `snarc_*` calls beside configured MCP tools.

## Configuration And Storage

MAGRA preserves upstream-compatible configuration paths for existing users:

- Compatibility settings path `~/.reasonix/config.json` for global settings and API key wiring.
- Compatibility project path `<project>/.reasonix/` for inherited project skills, hooks, permissions, and sessions.
- `<project>/.magra/snarc/memory.sqlite` for MAGRA SNARC memory.

Project-local MyGRACE governance lives in `docs/graph-index.xml`, `docs/plan-index.xml`, and `docs/verification-index.xml`. Start with those indexes before opening per-module files.

## Documentation

- [MAGRA operator flows](./docs/operations/MAGRA-operator-flows.md)
- [MAGRA release checklist](./docs/release/MAGRA-release-checklist.md)
- [MAGRA verification report](./docs/release/verification-report.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [CLI reference](./docs/CLI-REFERENCE.md)
- [Configuration guide](./docs/configuration.html)
- [Benchmarks](./benchmarks/)

## Release Surface

Release readiness is tracked in [docs/release/MAGRA-release-checklist.md](./docs/release/MAGRA-release-checklist.md). Phase evidence is recorded in [docs/release/verification-report.md](./docs/release/verification-report.md). The package includes `README.md`, `NOTICE.md`, `LICENSE`, dashboard assets, compiled runtime output, patches, and postinstall scripts.

## Upstream Attribution

MAGRA is built from and remains compatible with the upstream DeepSeek-Reasonix / Reasonix runtime. Upstream project links are preserved for attribution and audit:

- Upstream repository: <https://github.com/esengine/DeepSeek-Reasonix>
- Upstream website and guide: <https://esengine.github.io/DeepSeek-Reasonix/>
- Integrated-source attribution: [NOTICE.md](./NOTICE.md)

## License

MIT. See [LICENSE](./LICENSE).

# MAGRA Agent Protocol

MAGRA uses MyGRACE: scalable Graph-RAG Anchored Code Engineering with lazy
indexes and per-entity files. The product direction is MAGRA: Reasonix as the
base agent/web interface, with MyGRACE, RTK, and SNARC integrated as first-class
subsystems.

@/home/truffle/.codex/RTK.md

## Navigation Rule

Always start with index files. Never scan all per-entity files by default.

| Task | Read first | Then read |
|---|---|---|
| Project modules | `docs/graph-index.xml` | `docs/modules/M-XXX.xml` |
| Development phases | `docs/plan-index.xml` | `docs/plans/Phase-N.xml` |
| Verification | `docs/verification-index.xml` | `docs/verification/V-M-XXX.xml` |
| Source-project analysis | `docs/source-analysis-index.xml` | `docs/source-analysis/S-XXX.xml` |
| Architecture proposals | `docs/proposals-index.xml` | `docs/proposals/P-XXX.xml` |

Do not create or search for monolithic `knowledge-graph.xml`,
`development-plan.xml`, or `verification-plan.xml`.

## MyGRACE Principles

1. Never write code without a `MODULE_CONTRACT`.
2. Semantic blocks are navigation anchors, not ordinary comments.
3. `docs/graph-index.xml` must not drift from the real module surface.
4. Work top down: requirements -> technology -> plan -> verification -> code.
5. Verification is architectural: tests, traces, and log markers are required.
6. PCAM governs work: Purpose, Constraints, Autonomy, Metrics.

## Source Direction

DeepSeek-Reasonix is the base runtime and UI. MyGRACE, RTK, and SNARC are not
secondary add-ons; each must keep its full functional value:

- MyGRACE provides methodology, indexes, skills, CLI/MCP operations, and
  execution discipline.
- RTK provides token-optimized command execution and savings telemetry.
- SNARC provides salience-gated memory, consolidation, retrieval, and MCP tools.
- Reasonix provides the cache-first loop, tools, web dashboard, slash command
  system, hooks, memory surface, MCP bridge, and Tauri/desktop-ready UI.

## Shell Rule

Prefix shell commands with `rtk` whenever possible. Use `rtk proxy <cmd>` only
when raw output or exact command behavior is required.

## Editing Rules

- Preserve `MODULE_CONTRACT`, `MODULE_MAP`, `CHANGE_SUMMARY`, and block
  boundaries in managed files.
- Update `CHANGE_SUMMARY` after source or test edits.
- Update `docs/graph-index.xml` when public module interfaces change.
- Update `docs/verification-index.xml` and per-verification files when tests,
  verification commands, or required log markers change.
- If a contract is wrong, propose the contract change explicitly before
  deviating.
- After changes, run verification and commit the scoped changes when the repo
  permits it.

## Logging

Use stable markers:

```text
[ModuleName][functionName][BLOCK_NAME] message
```

Never log secrets, credentials, raw API keys, or high-risk payloads.

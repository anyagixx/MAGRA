<!-- === MODULE_CONTRACT ===
FILE: docs/operations/MAGRA-operator-flows.md
VERSION: 1.0.0
PURPOSE: Document operator workflows for MAGRA MyGRACE, RTK, SNARC, MCP, and dashboard use.
SCOPE: Practical local operation paths after Phase-6 hardening.
DEPENDS: M-MYGRACE-SKILLS,M-RTK-SHELL-POLICY,M-SNARC-MEMORY,M-MCP-UNIFIED-BRIDGE,M-WEB-MYGRACE-COMMANDS
LINKS: docs/plans/Phase-6.xml
ROLE: RELEASE
MAP_MODE: DOCUMENT
START_MODULE_CONTRACT
END_MODULE_CONTRACT
=== END_MODULE_CONTRACT === -->

# MAGRA Operator Flows

## Start

Run MAGRA from the project root:

```bash
magra code /path/to/project
```

The legacy `reasonix` and `dsnix` binaries remain aliases for compatibility, but MAGRA is the product name for this integration.

## MyGRACE

- In the web chat composer, type `/mygrace:` to see available methodology commands.
- Use `/mygrace:status` before work to read only the three MyGRACE indexes.
- Use `/mygrace:execute` to continue from the first pending phase.
- Use `mygrace_*` native tools when the model needs structured module, phase, lint, or file-contract context.

## RTK

- Eligible shell commands are automatically rewritten through `rtk`.
- Use `MAGRA_RTK_RAW=1` or an explicit `rtk proxy` command when raw shell behavior is required.
- Check RTK health through `magra doctor`, `/health`, or the dashboard health endpoint.

## SNARC

- SNARC memory is project-scoped under `.magra/snarc/memory.json`.
- Prompt submission injects provenance-labeled related memory when useful.
- Tool results are captured after tool execution.
- Compaction capture runs before history folding.
- Stop consolidation creates inferred patterns; deep dream remains explicitly optional unless a model client is wired.

## MCP And Native Tools

MAGRA registers these native tools in code mode:

- `mygrace_list_modules`, `mygrace_show_module`, `mygrace_show_phase`, `mygrace_lint`, `mygrace_show_file`
- `snarc_search`, `snarc_context`, `snarc_patterns`, `snarc_stats`

They coexist with configured MCP servers and do not replace existing transports.

## Dashboard

- `/api/health` includes RTK and SNARC health.
- `/api/snarc` returns stats, recent inferred patterns, and identity facts.
- `/api/snarc/search?query=...` returns provenance-labeled memory search results.
- `/api/snarc/context?query=...` returns conservative injectable context.

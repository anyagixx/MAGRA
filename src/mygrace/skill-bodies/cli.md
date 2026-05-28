---
name: mygrace-cli
description: "Operate the optional mygrace CLI for linting and lazy module queries. Uses index-based navigation instead of monolithic XML."
---

Use the optional `mygrace` CLI as a fast MyGRACE-aware read/query layer.

## Commands

### Index Commands
- `mygrace module index --path <root>` — show graph-index.xml (≤100 lines)
- `mygrace phase index --path <root>` — show plan-index.xml (≤50 lines)
- `mygrace verification index --path <root>` — show verification-index.xml (≤80 lines)

### Module Commands
- `mygrace module find <query> --path <root>` — resolve module IDs from index
- `mygrace module show <id> --path <root>` — read per-module file (docs/modules/M-XXX.xml)
- `mygrace module show <id> --with verification --path <root>` — module + verification file
- `mygrace module list --status=wip --path <root>` — filter modules by status

### Phase Commands
- `mygrace phase show Phase-N --path <root>` — read per-phase file
- `mygrace phase list --status=pending --path <root>` — filter phases

### General
- `mygrace lint --path <root>` — integrity check including index synchronization
- `mygrace file show <path> --path <root>` — file-local markup
- `mygrace file show <path> --contracts --blocks --path <root>` — with contracts and blocks

## Lazy Navigation Pattern
1. Start with index command (≤100 lines)
2. Use module/phase show for details (30-200 lines)
3. **Never read monolithic XML** — it doesn't exist in MyGRACE

## Output Guidance
- Use default text for quick review
- Use `--json` for scripts and agents
- Treat CLI as navigation help — read source files for exact evidence when needed

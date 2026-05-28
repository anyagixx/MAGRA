---
name: mygrace-setup-subagents
description: "Create MyGRACE subagent presets for Qwen Code. Scaffold lazy-loading-aware worker and reviewer agents."
---

Create MyGRACE subagent files for Qwen Code.

## Roles to Create
1. `mygrace-planner` — architecture planning with index-based output
2. `mygrace-implementer` — module implementation from execution packets
3. `mygrace-reviewer` — contract and index-consistency review
4. `mygrace-verifier` — verification design with per-entry files
5. `mygrace-fixer` — bug fixing via lazy navigation (index → module → block)

## Process
1. Determine scope: user-level (`~/.qwen/agents/`) or project-level (`.qwen/agents/`)
2. For each role, create a `.md` file with YAML frontmatter
3. Report created files

## Key Difference from Classic GRACE
All agents must be taught **lazy navigation**:
- Always start with index files
- Read only relevant per-entity files
- Never scan monolithic XML
- Update indexes after any change

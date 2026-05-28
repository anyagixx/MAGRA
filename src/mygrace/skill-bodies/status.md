---
name: mygrace-status
description: "Show MyGRACE project health by reading ONLY index files (~230 lines total vs ~6500 in classic GRACE). Fast and token-efficient."
---

Show the current state of the MyGRACE project.

## LAZY REPORT (reads only indexes — ~230 lines total)

### 1. Index Status (read these 3 files — ALWAYS)
- `docs/graph-index.xml` (≤100 lines) — module count, status distribution
- `docs/plan-index.xml` (≤50 lines) — phase count, status distribution
- `docs/verification-index.xml` (≤80 lines) — verification count, priority distribution

### 2. Codebase Metrics (fast scan)
- Total source files
- Files WITH MODULE_CONTRACT
- Files WITHOUT MODULE_CONTRACT (warning)
- Paired vs unpaired semantic blocks

### 3. Index Consistency Check
- Modules in graph-index vs files in docs/modules/
- Modules in graph-index vs source files with MODULE_CONTRACT
- Verification entries in verification-index vs files in docs/verification/
- Orphaned entries (in index but file missing)
- Missing entries (file exists but not in index)

### 4. Recent Changes
List 5 most recent CHANGE_SUMMARY entries (scan source files quickly)

### 5. Suggested Next Action
- No modules in index → "Run `/mygrace:plan`"
- Modules pending, no verification → "Run `/mygrace:verification`"
- Modules ready but not executed → "Run `/mygrace:execute`"
- Drift detected → "Run `/mygrace:refresh`"
- All synced → "Project is healthy"

## Token Budget
This entire report uses ~230 lines of context. Classic GRACE equivalent: ~6500 lines.
**Savings: 96%**

---
name: mygrace-multiagent-execute
description: "Execute MyGRACE plan in parallel waves with lazy-loading. Each wave reads only its phases and modules, not the entire plan."
---

Execute a MyGRACE plan with multiple agents using lazy-loading.

## Prerequisites
- `docs/plan-index.xml`, `docs/graph-index.xml` must exist
- `docs/verification-index.xml` should exist
- `docs/plans/` with Phase-N.xml files

## Core Principle
Parallelize **module implementation**, not **architectural truth**.
- Controller owns indexes and current phase files
- Workers own only their assigned module files
- Each worker reads ONLY its module — never the full plan

## Execution Profiles
- `safe` — approval per wave, review per module
- `balanced` (default) — one up-front approval, scoped reviews
- `fast` — mature codebases, minimal blocking

## LAZY LOADING (CRITICAL)

### Step 1: Build Waves from Index
1. Read `docs/plan-index.xml` (≤50 lines) — find pending phases
2. Read current `docs/plans/Phase-N.xml` — get steps
3. Group steps into parallel-safe waves (disjoint write scopes, all dependencies complete)
4. **DO NOT** read future phases — they're irrelevant now

### Step 2: Dispatch Workers
For each wave, for each module:
1. Give worker: `docs/modules/M-XXX.xml` (30-80 lines) + verification excerpt
2. Worker implements, tests, commits
3. Worker reads ONLY its module file — no plan scanning

### Step 3: Review and Integrate
1. Scoped review of changed files
2. Update `docs/graph-index.xml` — module statuses
3. Update `docs/plans/Phase-N.xml` — step statuses
4. Update `docs/plan-index.xml` — phase status when all steps done
5. Targeted `/mygrace:refresh` on touched modules

### Step 4: Report
```
=== WAVE COMPLETE ===
Wave: N | Modules: M-xxx, M-yyy
Context tokens per worker: ~130 lines (vs ~6500 in classic GRACE)
```

## Rules
- Workers commit after verification passes
- Controller commits only indexes and current phase files
- Never let workers read the full plan
- Archive completed phases to `docs/archive/` when project grows

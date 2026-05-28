---
name: mygrace-execute
description: "Execute the MyGRACE development plan with lazy-loading — reads only the current phase and relevant modules, not the entire plan."
---

Execute the development plan step by step with lazy-loading.

## Prerequisites
- `docs/plan-index.xml` must exist
- `docs/graph-index.xml` must exist
- `docs/verification-index.xml` should exist
- `docs/plans/` directory with Phase-N.xml files
- If missing, tell user to run `/mygrace:plan` and `/mygrace:verification` first

## LAZY LOADING (CRITICAL)

### Step 1: Load Only Current Phase
1. Read `docs/plan-index.xml` (≤50 lines) — find the first pending phase
2. Read `docs/plans/Phase-N.xml` (50-200 lines) — read ONLY the current phase
3. **DO NOT** read other phases — they'll be read when their turn comes

### Step 2: For Each Step — Load Only That Module
For each step in the phase:
1. From the step, get the module ID (e.g., M-AUTH)
2. Read `docs/modules/M-AUTH.xml` (30-80 lines) — the module contract
3. Read `docs/verification/V-M-AUTH.xml` (20-60 lines) — verification excerpt
4. **DO NOT** read other module files

### Step 3: Execute Each Step Sequentially
For each approved step:
1. Implement module with MODULE_CONTRACT, MODULE_MAP, CHANGE_SUMMARY, function contracts, semantic blocks
2. Add module-local tests
3. Run module-local verification
4. **Commit immediately after verification passes**
5. Run scoped review
6. Update step status in `docs/plans/Phase-N.xml`
7. Update module STATUS in `docs/graph-index.xml` (pending → wip → done)
8. Update module STATUS in `docs/modules/M-XXX.xml`
9. Print progress report

### Step 4: Complete Phase
After all steps done:
1. Update Phase-N status to "done" in `docs/plan-index.xml`
2. Run phase-level verification
3. Run `/mygrace:refresh` (targeted — only touched modules)
4. **Consider archiving**: move Phase-N.xml to `docs/archive/` if project is large
5. Commit phase update

### Step 5: Final Summary
```
=== EXECUTION COMPLETE ===
Phases executed: N
Modules generated: N
Context tokens used: ~150 lines per step (vs ~6500 in classic GRACE)
```

## Rules
- Steps within a phase are sequential
- Commit immediately after verification passes
- **Only read the current phase and current module** — never the full plan
- Update indexes after every change
- Use `mygrace module show M-XXX` for structured output when CLI is available

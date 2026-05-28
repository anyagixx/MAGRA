---
name: mygrace-refresh
description: "Synchronize MyGRACE indexes with per-entity files. Detects drift between graph-index.xml and docs/modules/, plan-index.xml and docs/plans/, etc."
---

Synchronize MyGRACE indexes with per-entity files.

## What MyGRACE Refresh Does
Classic GRACE refresh compares code against monolithic XML.
MyGRACE refresh compares **indexes against per-entity files**.

## Sync Checks

### 1. Graph Index ↔ Module Files
For each entry in `docs/graph-index.xml`:
- Does `docs/modules/M-XXX.xml` exist? → If no, flag as orphaned
- Does STATUS match between index and file? → If no, update index
- Does PATH in index match file's actual location? → If no, update index

For each file in `docs/modules/`:
- Is there a graph-index entry? → If no, add to index

### 2. Plan Index ↔ Phase Files
For each entry in `docs/plan-index.xml`:
- Does `docs/plans/Phase-N.xml` exist? → If no, flag as orphaned
- Does step count match? → If no, update index
- Does STATUS match? → If no, update index

### 3. Verification Index ↔ Verification Files
For each entry in `docs/verification-index.xml`:
- Does `docs/verification/V-M-XXX.xml` exist? → If no, flag as orphaned
- Does STATUS/PRIORITY match? → If no, update index

For each file in `docs/verification/`:
- Is there a verification-index entry? → If no, add to index

### 4. Archive Check
- If a phase is "done" and project has >10 modules, suggest archiving to `docs/archive/`

## Process
1. **Choose Scope**: `targeted` (specific modules) or `full` (all indexes)
2. **Scan indexes and per-entity directories**
3. **Compare** — find orphaned, missing, drifted entries
4. **Report** — structured drift report
5. **Fix with user approval** — update indexes or create missing files
6. **Commit** index updates

## Rules
- Indexes are the source of truth for navigation — they MUST be current
- Prefer targeted refresh after clean waves
- Archive old phases to keep active directories small
- Per-entity files can have implementation details that indexes don't need — that's by design

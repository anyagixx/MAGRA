---
name: mygrace-refactor
description: "Refactor MyGRACE-governed code safely. Updates per-module files AND indexes atomically."
---

Refactor without letting architecture, indexes, or verification drift.

## When to Use
rename, move, split, merge, extract, interface-tighten, path-only

## Key Difference from Classic GRACE
In addition to updating code and per-module files, you MUST update the **index entries**. If the index drifts, lazy navigation breaks.

## LAZY PROCESS

### Step 1: Classify the Refactor
Identify type, source/target module IDs and paths from `docs/graph-index.xml`.

### Step 2: Build Refactor Packet
Source scope, target scope, invariants, and delta summaries for:
- Source files and tests
- Per-module files (`docs/modules/M-XXX.xml`)
- Index entries (`docs/graph-index.xml`)
- Phase files (`docs/plans/Phase-N.xml`) and index (`docs/plan-index.xml`)
- Verification files (`docs/verification/V-M-XXX.xml`) and index (`docs/verification-index.xml`)

### Step 3: Apply Smallest Safe Refactor
- Update source code
- Update per-module files
- **Update index entries** — this is new and critical in MyGRACE
- Preserve semantic markup

### Step 4: Synchronize All Indexes
1. `docs/graph-index.xml` — update module IDs, names, paths, dependencies, statuses
2. `docs/plan-index.xml` — update phase step counts, statuses
3. `docs/verification-index.xml` — update verification entries

### Step 5: Verify by Blast Radius
Module-local → integration surfaces → index consistency check

### Step 6: Review and Refresh
- Scoped `/mygrace:reviewer` pass
- Targeted `/mygrace:refresh` on touched modules and indexes

## Rules
- **Index updates are mandatory** — refactor is not done until indexes match reality
- Never silently invent new architecture
- Get user approval for any contract/interface changes
- For split/merge: create new per-module files, update index with new entries, remove old entries

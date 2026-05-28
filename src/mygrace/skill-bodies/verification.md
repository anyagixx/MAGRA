---
name: mygrace-verification
description: "Design verification for MyGRACE projects. Creates per-module verification files and updates verification-index."
---

Design verification with lazy-loading. Creates per-module files, not monolithic XML.

## Prerequisites
- `docs/development-plan.xml` does NOT exist in MyGRACE — use `docs/graph-index.xml` + `docs/modules/M-XXX.xml`
- `docs/verification-index.xml` must exist (created by /mygrace:init)
- `docs/verification/` directory must exist

## Key Difference from Classic GRACE
**DO NOT** create monolithic `verification-plan.xml`.
Instead:
- Update `docs/verification-index.xml` with one line per entry (≤80 lines total)
- Create `docs/verification/V-M-XXX.xml` for each module (20-60 lines each)

## LAZY PROCESS

### Step 1: Load Context Efficiently
1. Read `docs/graph-index.xml` (≤100 lines) — find all modules
2. For target module, read `docs/modules/M-XXX.xml` (30-80 lines)
3. If verification already exists, read `docs/verification/V-M-XXX.xml` (20-60 lines)
4. **DO NOT** scan all modules — focus on one at a time

### Step 2: Derive Verification Targets
From module contract, extract: success scenarios, failure scenarios, critical invariants, side effects

### Step 3: Design Observability
Define `[Module][function][BLOCK_NAME]` log markers, critical branch visibility, redaction rules

### Step 4: Create Per-Module Verification File
Create/update `docs/verification/V-M-XXX.xml`:
```xml
<V-M-XXX MODULE="M-XXX" PRIORITY="high" STATUS="pending">
  <test-files><file>$TEST_PATH</file></test-files>
  <module-checks><check-1>$COMMAND</check-1></module-checks>
  <scenarios>
    <scenario-1 kind="success">$SCENARIO</scenario-1>
    <scenario-2 kind="failure">$SCENARIO</scenario-2>
  </scenarios>
  <required-log-markers>
    <marker-1>[Module][function][BLOCK]</marker-1>
  </required-log-markers>
</V-M-XXX>
```

### Step 5: Update Verification Index
Add or update line in `docs/verification-index.xml`:
```xml
<V-M-XXX MODULE="M-XXX" PRIORITY="high" STATUS="pending" />
```

### Step 6: Choose Evidence Types
Deterministic assertions first, trace assertions second, integration checks third

### Step 7: Apply Verification Levels
Module-local → wave-level → phase-level. Make explicit in the verification file.

## Deliverables
1. Updated `docs/verification-index.xml` (one line per module)
2. `docs/verification/V-M-XXX.xml` for each scoped module
3. Verification matrix
4. Telemetry requirements
5. Assessment of autonomous execution safety

## When to Use
- Before first `/mygrace:execute` or `/mygrace:multiagent` run
- When tests are too brittle or too shallow
- When bugs recur and logs aren't actionable
- Before enabling autonomous execution for a module

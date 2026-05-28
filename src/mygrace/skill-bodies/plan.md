---
name: mygrace-plan
description: "Run the MyGRACE architectural planning phase. Creates per-module files, per-phase files, and updates indexes instead of monolithic XML."
---

Run the MyGRACE architectural planning phase.

## Prerequisites
- `docs/requirements.xml` must exist with at least one UseCase
- `docs/technology.xml` must exist
- `docs/graph-index.xml`, `docs/plan-index.xml`, `docs/verification-index.xml` must exist
- If missing, tell user to run `/mygrace:init` first

## Key Difference from Classic GRACE
**DO NOT** create monolithic `knowledge-graph.xml` or `development-plan.xml`.
Instead:
- Update `docs/graph-index.xml` with one line per module
- Create `docs/modules/M-XXX.xml` for each module (30-80 lines each)
- Update `docs/plan-index.xml` with one line per phase
- Create `docs/plans/Phase-N.xml` for each phase (50-200 lines each)

## Process

### Phase 1: Analyze Requirements
Read `docs/requirements.xml`. Identify modules needed per UseCase.

### Phase 2: Design Module Architecture
For each module, define:
- ID (M-XXX), NAME, TYPE (ENTRY_POINT/CORE_LOGIC/DATA_LAYER/UI_COMPONENT/UTILITY/INTEGRATION)
- Purpose (one sentence)
- Dependencies
- Key public interfaces
- Source path, test path, verification-ref (V-M-XXX)

**Present to user for approval** before writing any files.

### Phase 3: Design Verification Surfaces
For each module:
- Assign V-M-XXX entry
- Identify test files, verification commands
- Define success/failure scenarios
- Identify required log markers

### Phase 4: Mental Walkthroughs
Trace 2-3 key scenarios through the index and proposed modules.

### Phase 5: Generate Artifacts (INDEX-BASED)
After user approval:

1. **Update `docs/graph-index.xml`** — add one line per module:
   ```xml
   <M-AUTH NAME="Authentication" TYPE="CORE_LOGIC" STATUS="pending" PATH="src/auth/index.ts" DEPENDS="M-CONFIG,M-DB" VERIFICATION_REF="V-M-AUTH" />
   ```

2. **Create `docs/modules/M-XXX.xml`** for each module — full contract, annotations, CrossLinks (30-80 lines each)

3. **Update `docs/plan-index.xml`** — add one line per phase:
   ```xml
   <Phase-1 name="Foundation" status="pending" steps="3" />
   ```

4. **Create `docs/plans/Phase-N.xml`** for each phase — steps with module refs

5. **Update `docs/verification-index.xml`** — add one line per verification entry:
   ```xml
   <V-M-AUTH MODULE="M-AUTH" PRIORITY="high" STATUS="pending" />
   ```

6. **Create `docs/verification/V-M-XXX.xml`** for each module — scenarios, commands, log markers

## Output
1. Module breakdown table
2. Data flow diagrams
3. Verification surface overview
4. Implementation order (phased)
5. Risk assessment

## Important
- Do NOT generate code — only planning artifacts
- Use unique ID tags: M-XXX, Phase-N, step-N, V-M-XXX
- Get explicit user approval before writing any files
- Every module gets its own file — no monolithic aggregation

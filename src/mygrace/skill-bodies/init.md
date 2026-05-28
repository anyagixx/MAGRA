---
name: mygrace-init
description: "Bootstrap MyGRACE framework structure for a new project. Creates docs/ with index-based architecture, per-module/phase/verification directories, and templates."
---

Initialize MyGRACE framework structure for this project.

## Steps

1. **Gather project info** from the user:
   - Project name, annotation, keywords
   - Primary language, runtime, framework (with versions)
   - Testing stack, observability stack
   - High-level module list (if known)
   - 2-5 critical flows or risky surfaces

2. **Create `docs/` directory** with index-based structure:
   ```
   docs/
     graph-index.xml              # ← lightweight module index (≤100 lines)
     plan-index.xml               # ← lightweight phase index (≤50 lines)
     verification-index.xml       # ← lightweight verification index (≤80 lines)
     operational-packets.xml      # ← packet templates (stays small)
     modules/                     # ← per-module files (M-XXX.xml)
     plans/                       # ← per-phase files (Phase-N.xml)
     verification/                # ← per-verification files (V-M-XXX.xml)
     archive/                     # ← completed phases
   ```

3. **Populate index files** from templates:
   - `graph-index.xml` — project name, keywords, annotation, no modules yet
   - `plan-index.xml` — empty, ready for phases
   - `verification-index.xml` — empty, ready for entries
   - `operational-packets.xml` — full template

4. **Create `AGENTS.md`** and **`QWEN.md`** at project root from templates

5. **Print summary** of all created files and suggest next step:
   > "Run `/mygrace:plan` to design modules. MyGRACE uses index-based navigation — each module gets its own file in docs/modules/, each phase in docs/plans/. No monolithic XML files."

## Important
- Never create monolithic knowledge-graph.xml, development-plan.xml, or verification-plan.xml
- All module data goes in `docs/modules/M-XXX.xml`
- All phase data goes in `docs/plans/Phase-N.xml`
- All verification data goes in `docs/verification/V-M-XXX.xml`
- Index files are the ALWAYS-READ entry points

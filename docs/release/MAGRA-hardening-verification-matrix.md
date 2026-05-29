<!-- === MODULE_CONTRACT ===
FILE: docs/release/MAGRA-hardening-verification-matrix.md
VERSION: 1.0.0
PURPOSE: Summarize verification strategy for MAGRA Phase-7 through Phase-12 hardening and dogfooding.
SCOPE: Verification matrix, telemetry requirements, and autonomous execution safety overview for pending hardening modules.
DEPENDS: M-SNARC-CONTEXT-ISOLATION,M-SNARC-SQLITE-STORE,M-MAGRA-RUNTIME-IDENTITY,M-MYGRACE-GOVERNANCE-LINT,M-MAGRA-RELEASE-SURFACE,M-MAGRA-DOGFOODING-HARNESS
LINKS: docs/plans/Phase-19.xml
ROLE: VERIFICATION
MAP_MODE: DOCUMENT
START_MODULE_CONTRACT
END_MODULE_CONTRACT
=== END_MODULE_CONTRACT === -->

<!-- === MODULE_MAP ===
Sections: Verification Matrix, Telemetry Requirements, Autonomous Safety Gate
=== END_MODULE_MAP === -->

<!-- === CHANGE_SUMMARY ===
v1.0.0 - Initial Phase-7 through Phase-12 verification matrix.
=== END_CHANGE_SUMMARY === -->

# MAGRA Hardening Verification Matrix

## Verification Matrix

| Phase | Module | Primary Evidence | Blocking Failure |
|---|---|---|---|
| Phase-7 | M-SNARC-CONTEXT-ISOLATION | Transcript/session assertions plus SNARC adapter traces | SNARC context persisted as role=user or exported transcript text |
| Phase-8 | M-SNARC-SQLITE-STORE | SQLite schema, migration, transaction, MCP, and dashboard tests | Data loss, duplicate import, corrupt DB overwrite, or JSON store as primary path |
| Phase-9 | M-MAGRA-RUNTIME-IDENTITY | Prompt, CLI, dashboard, package bin, and alias compatibility tests | Primary runtime still self-identifies as Reasonix |
| Phase-10 | M-MYGRACE-GOVERNANCE-LINT | Negative lint fixtures plus real-tree MyGRACE lint | Managed files can miss contract/map/change markers undetected |
| Phase-11 | M-MAGRA-RELEASE-SURFACE | Docs/package metadata assertions plus package smoke | Ambiguous MAGRA/Reasonix release identity or broken attribution |
| Phase-12 | M-MAGRA-DOGFOODING-HARNESS | Disposable project smoke, dogfooding report, and full regression | Critical or high dogfooding blocker remains unresolved |

## Telemetry Requirements

- Use stable log markers in the `[Module][function][BLOCK_NAME]` format.
- Keep prompt and memory payloads redacted; record counts, status, and bounded summaries only.
- Record exact verification commands and outcomes in phase reports.
- Dogfooding evidence must distinguish deterministic smoke results from manual UX observations.

## Autonomous Safety Gate

- Phase-7 and Phase-8 require deterministic tests before autonomous broad execution.
- Phase-10 may run autonomously only with negative fixtures that prove the rule catches drift.
- Phase-12 may mutate disposable workspaces only; real pet projects require explicit operator approval.

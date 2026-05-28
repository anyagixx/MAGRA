<!-- === MODULE_CONTRACT ===
FILE: docs/dogfooding/MAGRA-dogfooding-report.md
VERSION: 1.0.0
PURPOSE: Record MAGRA dogfooding scenarios, command evidence, friction, and beta readiness.
SCOPE: Disposable Node CLI, React/Vite, docs/tooling, MyGRACE web chat, RTK, SNARC, MCP, and dashboard checks.
DEPENDS: M-MAGRA-DOGFOODING-HARNESS,M-MAGRA-RELEASE-SURFACE,M-SNARC-SQLITE-STORE
LINKS: docs/plans/Phase-12.xml
ROLE: RELEASE
MAP_MODE: DOCUMENT
START_MODULE_CONTRACT
END_MODULE_CONTRACT
=== END_MODULE_CONTRACT === -->

<!-- === MODULE_MAP ===
Sections: Summary, Scenario Matrix, Command Evidence, Friction Log, Follow-Up Backlog, Beta Readiness
=== END_MODULE_MAP === -->

<!-- === CHANGE_SUMMARY ===
Initial MAGRA dogfooding report for Phase-12 beta readiness.
=== END_CHANGE_SUMMARY === -->

# MAGRA Dogfooding Report

Date: 2026-05-29
Scope: Disposable pet-project workflows only. No real user project files, prompts, API keys, or secrets were used.

## Summary

MAGRA is beta-ready for local pet-project development workflows when used with its current constraints: DeepSeek API key required for live model turns, inherited compatibility config paths under `.reasonix`, and SNARC memory stored locally under `.magra/snarc/memory.sqlite`.

No critical or high dogfooding blockers were found. Medium/low follow-ups are tracked below.

## Scenario Matrix

| Scenario | Disposable Workspace | Exact Exercise | Outcome | Friction |
|---|---|---|---|---|
| Node CLI pet project | Temporary `magra-node-cli-*` directory | Created a tiny CLI script, executed it with Node, verified RTK would rewrite `npm test` style commands. | Passed | None in deterministic smoke. |
| React/Vite pet project | Temporary `magra-react-vite-*` directory | Created Vite-style `package.json`, `index.html`, `src/App.jsx`, verified dashboard `/mygrace:` command metadata and submission routing. | Passed | Live visual comfort still needs browser dogfooding with screenshots before public beta. |
| Docs/tooling project | Temporary `magra-docs-tooling-*` directory | Created MyGRACE indexes, module XML, verification XML, and governed source file; ran MyGRACE artifact lint. | Passed | MyGRACE fixture setup is verbose without a project scaffold helper. |
| Cross-cutting memory/API | Temporary `magra-snarc-dogfood-*` directory | Captured SNARC observation, reopened via SQLite-backed search, and queried dashboard SNARC API search/stats handlers. | Passed | None in deterministic smoke. |

## Command Evidence

```bash
rtk npm test -- tests/magra-dogfooding-smoke.test.ts
rtk npm test -- tests/dashboard-mygrace-commands.test.tsx tests/rtk-shell-policy.test.ts tests/snarc-sqlite-store.test.ts tests/dashboard-snarc-server.test.ts tests/mcp-unified-bridge.test.ts
rtk mygrace lint --path .
rtk npm run lint
rtk npm run typecheck
rtk npm run build
rtk npm test
```

Results:

- `rtk npm test -- tests/magra-dogfooding-smoke.test.ts`: passed, 5 tests.
- Focused web MyGRACE, RTK, SNARC, dashboard SNARC, and MCP bridge tests: passed, 17 tests.
- `rtk mygrace lint --path .`: passed with 0 errors and 0 warnings.
- `rtk npm run lint`: passed.
- `rtk npm run typecheck`: passed.
- `rtk npm run build`: passed.
- `rtk npm test`: passed, 319 test files, 3966 tests passed, 9 skipped.

## Friction Log

| Severity | Area | Observation | Follow-up |
|---|---|---|---|
| medium | UI dogfooding | Automated tests verify web slash routing, but this report does not include a Playwright/browser screenshot pass for subjective comfort. | Add browser dogfooding with screenshots before public beta announcement. |
| low | MyGRACE scaffolding | Creating a valid disposable MyGRACE fixture requires several XML files. | Add a test helper or CLI scaffold smoke path for dogfooding fixtures. |
| low | Compatibility paths | MAGRA still documents inherited `.reasonix` paths for config, skills, hooks, and sessions. | Decide in a later migration whether to introduce `.magra` config aliases beyond SNARC memory. |

## Follow-Up Backlog

| Priority | Item | Owner | Status |
|---|---|---|---|
| P1 | Run browser-based dashboard dogfooding with screenshots for `/mygrace:` picker, SNARC panel, and command submission comfort. | MAGRA | open |
| P2 | Add a reusable disposable MyGRACE project fixture generator for tests and demos. | MAGRA | open |
| P3 | Evaluate `.magra` config path migration or alias strategy for non-SNARC runtime data. | MAGRA | open |

## Beta Readiness

Decision: Beta-ready for private/operator pet-project use after Phase-12 verification.

Conditions:

- No unresolved critical or high blockers.
- Full test suite, build, lint, typecheck, MyGRACE lint, and focused dogfooding smoke pass.
- Release surface clearly presents MAGRA as the primary command and product.
- Known medium/low follow-ups are documented and do not block private beta usage.

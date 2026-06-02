<!-- === MODULE_CONTRACT ===
FILE: docs/release/verification-report.md
VERSION: 1.0.0
PURPOSE: Record MAGRA release, installer, publication, and dogfooding verification evidence.
SCOPE: Commands, outcomes, and known non-blocking warnings for release hardening, release surface checks, installer readiness, GitHub publication, and dogfooding readiness.
DEPENDS: M-OBSERVABILITY-VERIFICATION,M-MAGRA-RELEASE-SURFACE,M-MAGRA-DOGFOODING-HARNESS,M-MAGRA-RELEASE-VERIFICATION,M-MAGRA-PACKAGE-README-GATE,M-MAGRA-DOCS-SITE-SURFACE
LINKS: docs/plans/Phase-6.xml,docs/plans/Phase-11.xml,docs/plans/Phase-12.xml,docs/plans/Phase-15.xml,docs/plans/Phase-19.xml
ROLE: VERIFICATION
MAP_MODE: DOCUMENT
START_MODULE_CONTRACT
END_MODULE_CONTRACT
=== END_MODULE_CONTRACT === -->

<!-- === MODULE_MAP ===
Sections: Commands, Results, Known Warning
=== END_MODULE_MAP === -->

<!-- === CHANGE_SUMMARY ===
Initial Phase-6 MAGRA verification evidence.
Added Phase-10 governance metadata for release verification linting.
Updated Phase-11 release surface verification evidence.
Updated Phase-12 dogfooding verification evidence.
Added Phase-15 v0.1.0 installer and release verification evidence.
Added v0.1.1 MyGRACE skill asset hotfix verification evidence.
Added v0.1.2 MyGRACE web dispatch hotfix verification evidence.
Added Phase-20 fork-state cleanup and Phase-21 web attachment foundation verification evidence.
Added focused dashboard attachment transport and submit API checks.
Added broader issue-template and localized copy cleanup verification evidence.
Added v0.1.6 image attachment submit hotfix verification evidence.
Added v0.1.7 image capability gate verification evidence.
=== END_CHANGE_SUMMARY === -->

# MAGRA Verification Report

Date: 2026-06-02

## Commands

```bash
rtk bash scripts/install.sh --dry-run
rtk npm test -- tests/dashboard-mygrace-server.test.ts tests/dashboard-mygrace-commands.test.tsx tests/hash-memory.test.ts tests/server-dashboard.test.ts
rtk npm test -- tests/server-dashboard.test.ts tests/dashboard-server-bridge-refresh.test.ts
rtk npm test -- tests/server-dashboard.test.ts tests/dashboard-server-bridge-refresh.test.ts tests/client-models.test.ts tests/desktop-session-load.test.ts
rtk npm test -- tests/server-dashboard.test.ts tests/dashboard-server-bridge-refresh.test.ts tests/client-models.test.ts tests/desktop-session-load.test.ts tests/feedback.test.ts
rtk npm test -- tests/bundle-smoke.test.ts tests/mygrace-skills.test.ts tests/dashboard-mygrace-server.test.ts tests/magra-install-script.test.ts tests/magra-release-surface.test.ts
rtk npm test -- tests/magra-install-script.test.ts tests/magra-release-surface.test.ts
rtk npm test -- tests/magra-install-script.test.ts tests/magra-release-surface.test.ts tests/dashboard-composer-ime.test.tsx tests/server-dashboard.test.ts tests/dashboard-server-bridge-refresh.test.ts
rtk npm test -- tests/magra-release-surface.test.ts tests/magra-runtime-identity.test.ts tests/installer-nsh-no-placeholders.test.ts
rtk npm test -- tests/magra-release-surface.test.ts tests/mygrace-governance-lint.test.ts tests/mygrace-docs.test.ts
rtk npm test -- tests/magra-dogfooding-smoke.test.ts
rtk mygrace lint --path .
rtk npm run verify
rtk npm run lint
rtk npm run typecheck
rtk npm run build
rtk npm test
rtk npm pack --dry-run --json
```

## Results

- `rtk npm test -- tests/magra-release-surface.test.ts tests/magra-runtime-identity.test.ts tests/installer-nsh-no-placeholders.test.ts`: passed.
- `rtk npm test -- tests/magra-release-surface.test.ts tests/mygrace-governance-lint.test.ts tests/mygrace-docs.test.ts`: passed, 3 test files and 16 tests passed.
- `rtk npm test -- tests/dashboard-mygrace-server.test.ts tests/dashboard-mygrace-commands.test.tsx tests/hash-memory.test.ts tests/server-dashboard.test.ts tests/magra-install-script.test.ts tests/magra-release-surface.test.ts`: passed, 6 test files and 116 tests passed.
- `rtk npm test -- tests/server-dashboard.test.ts tests/dashboard-server-bridge-refresh.test.ts`: passed, 2 test files and 89 tests passed.
- `rtk npm test -- tests/server-dashboard.test.ts tests/dashboard-server-bridge-refresh.test.ts tests/client-models.test.ts tests/desktop-session-load.test.ts`: passed, 4 test files and 98 tests passed.
- `rtk npm test -- tests/server-dashboard.test.ts tests/dashboard-server-bridge-refresh.test.ts tests/client-models.test.ts tests/desktop-session-load.test.ts tests/feedback.test.ts`: passed, 5 test files and 107 tests passed.
- `rtk bash scripts/install.sh --dry-run`: passed.
- `rtk npm test -- tests/magra-install-script.test.ts tests/magra-release-surface.test.ts`: passed, 2 test files and 12 tests passed.
- `rtk npm test -- tests/magra-install-script.test.ts tests/magra-release-surface.test.ts tests/dashboard-composer-ime.test.tsx tests/server-dashboard.test.ts tests/dashboard-server-bridge-refresh.test.ts`: passed, 5 test files and 103 tests passed.
- `rtk npm test -- tests/magra-dogfooding-smoke.test.ts`: passed.
- `rtk mygrace lint --path .`: passed with 0 errors and 0 warnings.
- `rtk npm run verify`: passed.
- `rtk npm run lint`: passed.
- `rtk npm run typecheck`: passed.
- `rtk npm run build`: passed.
- `rtk npm test`: passed, 320 test files, 3998 tests passed, 9 skipped.
- `rtk npm pack --dry-run --json`: passed, package preview reports `magra@0.1.7` / `magra-0.1.7.tgz` and includes README.md, README.zh-CN.md, README.ja-JP.md, 14 `dist/cli/skill-bodies/*` files, 14 `dist/skill-bodies/*` files, and `scripts/install.sh`.


## Known Warning

Vite reports that `dashboard/src/lib/tauri-bridge.ts` is both statically and dynamically imported. This warning existed before the Phase-5 SNARC work and did not block build output.

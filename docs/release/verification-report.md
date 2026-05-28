<!-- === MODULE_CONTRACT ===
FILE: docs/release/verification-report.md
VERSION: 1.0.0
PURPOSE: Record MAGRA release verification evidence.
SCOPE: Commands, outcomes, and known non-blocking warnings for release hardening and release surface checks.
DEPENDS: M-OBSERVABILITY-VERIFICATION,M-MAGRA-RELEASE-SURFACE
LINKS: docs/plans/Phase-6.xml,docs/plans/Phase-11.xml
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
=== END_CHANGE_SUMMARY === -->

# MAGRA Verification Report

Date: 2026-05-29

## Commands

```bash
rtk npm test -- tests/magra-release-surface.test.ts tests/magra-runtime-identity.test.ts tests/installer-nsh-no-placeholders.test.ts
rtk mygrace lint --path .
rtk npm run lint
rtk npm run typecheck
rtk npm run build
rtk npm test
rtk npm pack --dry-run
```

## Results

- `rtk npm test -- tests/magra-release-surface.test.ts tests/magra-runtime-identity.test.ts tests/installer-nsh-no-placeholders.test.ts`: passed.
- `rtk mygrace lint --path .`: passed with 0 errors and 0 warnings.
- `rtk npm run lint`: passed.
- `rtk npm run typecheck`: passed.
- `rtk npm run build`: passed.
- `rtk npm test`: passed, 318 test files, 3961 tests passed, 9 skipped.
- `rtk npm pack --dry-run`: passed, package artifact preview `magra-0.52.0.tgz`.

## Known Warning

Vite reports that `dashboard/src/lib/tauri-bridge.ts` is both statically and dynamically imported. This warning existed before the Phase-5 SNARC work and did not block build output.

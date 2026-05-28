<!-- === MODULE_CONTRACT ===
FILE: docs/release/verification-report.md
VERSION: 1.0.0
PURPOSE: Record Phase-6 MAGRA verification evidence.
SCOPE: Commands, outcomes, and known non-blocking warnings for release hardening.
DEPENDS: M-OBSERVABILITY-VERIFICATION
LINKS: docs/plans/Phase-6.xml
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
=== END_CHANGE_SUMMARY === -->

# MAGRA Verification Report

Date: 2026-05-28

## Commands

```bash
rtk npm run lint
rtk npm run typecheck
rtk mygrace lint --path .
rtk npm test
rtk npm run build
```

## Results

- `rtk npm run lint`: passed.
- `rtk npm run typecheck`: passed.
- `rtk mygrace lint --path .`: passed with 0 errors and 0 warnings.
- `rtk npm test`: passed, 313 test files, 3943 tests passed, 9 skipped.
- `rtk npm run build`: passed.

## Known Warning

Vite reports that `dashboard/src/lib/tauri-bridge.ts` is both statically and dynamically imported. This warning existed before the Phase-5 SNARC work and did not block build output.

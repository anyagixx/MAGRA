<!-- === MODULE_CONTRACT ===
FILE: docs/release/MAGRA-release-checklist.md
VERSION: 1.0.0
PURPOSE: Provide MAGRA release checklist and rollback notes.
SCOPE: Packaging, verification, operational readiness, and rollback controls for MAGRA releases.
DEPENDS: M-OBSERVABILITY-VERIFICATION
LINKS: docs/plans/Phase-6.xml
ROLE: RELEASE
MAP_MODE: DOCUMENT
START_MODULE_CONTRACT
END_MODULE_CONTRACT
=== END_MODULE_CONTRACT === -->

<!-- === MODULE_MAP ===
Sections: Preflight, Verification, Runtime Smoke, Rollback
=== END_MODULE_MAP === -->

<!-- === CHANGE_SUMMARY ===
Initial MAGRA release readiness checklist.
Added Phase-10 governance metadata for release checklist linting.
Updated Phase-11 MAGRA-first package metadata and release surface checks.
Added Phase-14 GitHub installer checks for v0.1.0.
=== END_CHANGE_SUMMARY === -->

# MAGRA Release Checklist

## Preflight

- Confirm `package.json` name is `magra` and binaries include `magra`.
- Confirm `package.json` version is `0.1.0` for the first standalone MAGRA release.
- Confirm `package.json` repository, bugs, and homepage point to MAGRA release surfaces.
- Confirm `reasonix` and `dsnix` bins are documented only as compatibility aliases.
- Confirm `NOTICE.md` and `CHANGELOG.md` are included in package files.
- Confirm `README.md` install and quickstart commands use `magra`.
- Confirm `README.md` documents the GitHub one-command installer before npm install examples.
- Confirm `scripts/install.sh --dry-run` prints clone, build, and shim actions without writing install files.
- Confirm `README.md` keeps upstream Reasonix attribution.
- Confirm MyGRACE indexes show Phases 13-16 as done before release tagging.

## Verification

Run:

```bash
rtk npm run lint
rtk npm run typecheck
rtk mygrace lint --path .
rtk bash scripts/install.sh --dry-run
rtk npm test -- tests/magra-install-script.test.ts tests/magra-release-surface.test.ts
rtk npm test
rtk npm run build
rtk npm pack --dry-run
```

Expected result: all commands pass. The existing Vite warning about `dashboard/src/lib/tauri-bridge.ts` static and dynamic import is non-blocking unless it changes into a build failure.

## Runtime Smoke

- Start `magra code` in a disposable project.
- Open the dashboard URL.
- Type `/mygrace:status` in chat and verify the MyGRACE prompt packet is submitted.
- Run a safe read command and confirm RTK rewrites eligible shell execution.
- Call `snarc_stats` and `snarc_search` from the native tool surface after one tool run.
- Open `/api/snarc` and confirm stats are returned.

## Rollback

- Revert the release tag or deployment artifact.
- If SNARC memory causes operator confusion, delete only the project-local `.magra/snarc/` directory.
- If RTK routing must be bypassed during incident response, set `MAGRA_RTK_RAW=1`.
- If MyGRACE docs drift, run `rtk mygrace lint --path .` and restore the last passing commit.

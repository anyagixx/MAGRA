<!-- === MODULE_CONTRACT ===
FILE: docs/release/MAGRA-github-release.md
VERSION: 1.0.0
PURPOSE: Define the GitHub publication path for MAGRA releases.
SCOPE: Official repository, branch, tag, release notes, install URL, and rollback commands.
DEPENDS: M-MAGRA-GITHUB-RELEASE,M-MAGRA-INSTALL-SCRIPT
LINKS: docs/modules/M-MAGRA-GITHUB-RELEASE.xml
ROLE: RELEASE
MAP_MODE: DOCUMENT
START_MODULE_CONTRACT
END_MODULE_CONTRACT
=== END_MODULE_CONTRACT === -->

<!-- === MODULE_MAP ===
Sections: Repository, Release Target, Install URL, Publication Commands, Rollback
=== END_MODULE_MAP === -->

<!-- === CHANGE_SUMMARY ===
Initial MAGRA v0.1.0 GitHub release publication plan.
Updated current release target to v0.1.1 for the MyGRACE skill asset hotfix.
Updated current release target to v0.1.2 for the MyGRACE web dispatch hotfix.
Updated current release target to v0.1.5 for oversized image preview hotfix.
Updated current release target to v0.1.6 for image attachment submit hotfix.
Updated current release target to v0.1.7 for image capability gate hotfix.
=== END_CHANGE_SUMMARY === -->

# MAGRA GitHub Release

## Repository

Official repository: `https://github.com/anyagixx/MAGRA.git`

Default branch: `main`

Local reference-only source imports under `SOURCES/` are not release artifacts and must remain untracked.

## Release Target

Version: `0.1.7`

Tag: `v0.1.7`

Package preview: `magra-0.1.7.tgz`

## Install URL

```bash
curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash
```

Pinned release install:

```bash
MAGRA_REF=v0.1.7 curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash
```

## Publication Commands

```bash
rtk git branch -M main
rtk git remote add origin https://github.com/anyagixx/MAGRA.git
rtk git push -u origin main
rtk git tag -a v0.1.7 -m "MAGRA v0.1.7"
rtk git push origin v0.1.7
```

## Rollback

```bash
rtk git push origin :refs/tags/v0.1.7
rtk git tag -d v0.1.7
```

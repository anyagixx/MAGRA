#!/usr/bin/env bash
# === MODULE_CONTRACT ===
# FILE: scripts/install.sh
# VERSION: 1.0.0
# PURPOSE: Install MAGRA from the official GitHub repository with one command.
# SCOPE: Dependency checks, clone/update, selected ref checkout, build, local command shim, dry-run, and PATH guidance.
# DEPENDS: M-MAGRA-INSTALL-SCRIPT,M-MAGRA-GITHUB-RELEASE
# LINKS: docs/modules/M-MAGRA-INSTALL-SCRIPT.xml
# ROLE: INSTALLER
# MAP_MODE: FUNCTIONS
# === END_MODULE_CONTRACT ===
#
# === MODULE_MAP ===
# Functions: usage, log, fail, run, require_command, require_node, clone_or_update_repo, checkout_ref, build_repo, install_shim, verify_install, main
# === END_MODULE_MAP ===
#
# === CHANGE_SUMMARY ===
# v1.0.0 - Initial GitHub one-command MAGRA installer.
# === END_CHANGE_SUMMARY ===

set -euo pipefail

MAGRA_REPO_URL="${MAGRA_REPO_URL:-https://github.com/anyagixx/MAGRA.git}"
MAGRA_INSTALL_DIR="${MAGRA_INSTALL_DIR:-$HOME/.magra/repo}"
MAGRA_BIN_DIR="${MAGRA_BIN_DIR:-$HOME/.local/bin}"
MAGRA_REF="${MAGRA_REF:-main}"
MAGRA_SKIP_BUILD="${MAGRA_SKIP_BUILD:-0}"
MAGRA_DRY_RUN=0

usage() {
  cat <<'USAGE'
MAGRA installer

Usage:
  bash scripts/install.sh [--dry-run] [--skip-build]

Environment:
  MAGRA_REPO_URL      Git repository URL. Default: https://github.com/anyagixx/MAGRA.git
  MAGRA_REF           Git branch, tag, or commit to install. Default: main
  MAGRA_INSTALL_DIR   Clone/update directory. Default: $HOME/.magra/repo
  MAGRA_BIN_DIR       Directory for the magra command shim. Default: $HOME/.local/bin
  MAGRA_SKIP_BUILD    Set to 1 to skip npm run build.

One-command install:
  curl -fsSL https://raw.githubusercontent.com/anyagixx/MAGRA/main/scripts/install.sh | bash
USAGE
}

log() {
  printf '[MagraInstallScript][%s] %s\n' "$1" "$2"
}

fail() {
  printf '[MagraInstallScript][error] %s\n' "$1" >&2
  exit 1
}

run() {
  if [[ "$MAGRA_DRY_RUN" == "1" ]]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

run_in_repo() {
  if [[ "$MAGRA_DRY_RUN" == "1" ]]; then
    printf '+ (cd %q &&' "$MAGRA_INSTALL_DIR"
    printf ' %q' "$@"
    printf ')\n'
    return 0
  fi
  (cd "$MAGRA_INSTALL_DIR" && "$@")
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

require_node() {
  require_command node
  node -e 'const major = Number(process.versions.node.split(".")[0]); process.exit(major >= 22 ? 0 : 1)' \
    || fail "MAGRA requires Node.js 22 or newer."
}

clone_or_update_repo() {
  log "cloneOrUpdateRepo" "BLOCK_SYNC_REPO repo=$MAGRA_REPO_URL ref=$MAGRA_REF"
  if [[ -d "$MAGRA_INSTALL_DIR/.git" ]]; then
    run_in_repo git fetch --tags --prune origin
    return 0
  fi

  if [[ -e "$MAGRA_INSTALL_DIR" ]]; then
    fail "Install directory exists but is not a git repository: $MAGRA_INSTALL_DIR"
  fi

  if [[ "$MAGRA_DRY_RUN" != "1" ]]; then
    mkdir -p "$(dirname "$MAGRA_INSTALL_DIR")"
  fi
  run git clone "$MAGRA_REPO_URL" "$MAGRA_INSTALL_DIR"
}

checkout_ref() {
  log "checkoutRef" "BLOCK_CHECKOUT_REF ref=$MAGRA_REF"
  if [[ "$MAGRA_DRY_RUN" == "1" ]]; then
    printf '+ (cd %q && git checkout %q or origin/%q)\n' "$MAGRA_INSTALL_DIR" "$MAGRA_REF" "$MAGRA_REF"
    return 0
  fi

  if git -C "$MAGRA_INSTALL_DIR" show-ref --verify --quiet "refs/remotes/origin/$MAGRA_REF"; then
    git -C "$MAGRA_INSTALL_DIR" checkout -B "$MAGRA_REF" "origin/$MAGRA_REF"
  else
    git -C "$MAGRA_INSTALL_DIR" checkout "$MAGRA_REF"
  fi
}

build_repo() {
  log "buildRepo" "BLOCK_BUILD_REPO"
  run_in_repo npm ci
  if [[ "$MAGRA_SKIP_BUILD" == "1" ]]; then
    log "buildRepo" "Skipping npm run build because MAGRA_SKIP_BUILD=1."
    return 0
  fi
  run_in_repo npm run build
}

install_shim() {
  log "installShim" "BLOCK_WRITE_SHIM bin=$MAGRA_BIN_DIR/magra"
  local shim="$MAGRA_BIN_DIR/magra"
  local entry="$MAGRA_INSTALL_DIR/dist/cli/index.js"

  if [[ "$MAGRA_DRY_RUN" == "1" ]]; then
    printf '+ mkdir -p %q\n' "$MAGRA_BIN_DIR"
    printf '+ write shim %q -> node %q\n' "$shim" "$entry"
    printf '+ chmod +x %q\n' "$shim"
    return 0
  fi

  mkdir -p "$MAGRA_BIN_DIR"
  cat >"$shim" <<SHIM
#!/usr/bin/env bash
MAGRA_ENTRY="$entry"
exec node "\$MAGRA_ENTRY" "\$@"
SHIM
  chmod +x "$shim"
}

verify_install() {
  log "verifyInstall" "BLOCK_VERIFY_INSTALL"
  local shim="$MAGRA_BIN_DIR/magra"
  if [[ "$MAGRA_DRY_RUN" == "1" ]]; then
    printf '+ %q --version\n' "$shim"
    return 0
  fi

  "$shim" --version >/dev/null
  case ":$PATH:" in
    *":$MAGRA_BIN_DIR:"*) ;;
    *) log "verifyInstall" "Add $MAGRA_BIN_DIR to PATH to run magra from any shell." ;;
  esac
  log "verifyInstall" "MAGRA installed: $shim"
}

main() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dry-run)
        MAGRA_DRY_RUN=1
        ;;
      --skip-build)
        MAGRA_SKIP_BUILD=1
        ;;
      --help|-h)
        usage
        return 0
        ;;
      *)
        fail "Unknown argument: $1"
        ;;
    esac
    shift
  done

  log "main" "BLOCK_VALIDATE_TOOLS"
  require_command git
  require_command npm
  require_node
  clone_or_update_repo
  checkout_ref
  build_repo
  install_shim
  verify_install
}

main "$@"

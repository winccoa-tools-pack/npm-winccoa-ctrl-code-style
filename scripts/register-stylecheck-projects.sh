#!/usr/bin/env bash
# register-stylecheck-projects.sh
#
# Register StyleCheck (non-runnable) and a worker/source project (runnable)
# with StyleCheck as --sub-project, using npm-winccoa-register-project.
#
# Usable locally and in CI.
#
# Example:
#   ./scripts/register-stylecheck-projects.sh \
#     --project-path ./src/Squirt \
#     --version 3.21 \
#     --langs en_US.utf8
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROJECT_PATH=""
VERSION=""
LANGS="en_US.utf8"
STYLE_CHECK_PATH="${PKG_ROOT}/winccoa/StyleCheck"
REGISTER_CLI=""
DRY_RUN=0

usage() {
  cat <<EOF
Usage: $(basename "$0") --project-path <workerProject> [options]

Register:
  1) StyleCheck as non-runnable WinCC OA project
  2) Worker project as runnable with --sub-project StyleCheck

Options:
  --project-path <path>       Runnable worker/source project (required)
  -v, --version <ver>         WinCC OA version (e.g. 3.21)
  --langs <csv>               Languages (default: en_US.utf8)
  --style-check-path <path>   StyleCheck path (default: package winccoa/StyleCheck)
  --register-cli <path>       Path to npm-winccoa-register CLI js entry
  --dry-run                   Print commands only
  -h, --help                  Show help

Environment:
  WINCCOA_VERSION             Fallback for --version
  WINCCOA_REGISTER_CLI        Fallback for --register-cli

After success, run style check with worker config, e.g.:
  WCCOActrl -config <worker>/config/config -n -log +stderr astyle.ctl <source>
  # or:
  winccoa-ctrl-style check <worker> -v <ver> --no-register
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project-path)
      PROJECT_PATH="${2:-}"; shift 2 ;;
    -v|--version)
      VERSION="${2:-}"; shift 2 ;;
    --langs)
      LANGS="${2:-}"; shift 2 ;;
    --style-check-path)
      STYLE_CHECK_PATH="${2:-}"; shift 2 ;;
    --register-cli)
      REGISTER_CLI="${2:-}"; shift 2 ;;
    --dry-run)
      DRY_RUN=1; shift ;;
    -h|--help)
      usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1 ;;
  esac
done

VERSION="${VERSION:-${WINCCOA_VERSION:-}}"
REGISTER_CLI="${REGISTER_CLI:-${WINCCOA_REGISTER_CLI:-}}"

if [[ -z "${PROJECT_PATH}" ]]; then
  echo "Error: --project-path is required" >&2
  usage >&2
  exit 1
fi

if [[ -z "${VERSION}" ]]; then
  echo "Error: --version (or WINCCOA_VERSION) is required" >&2
  exit 1
fi

# Resolve absolute paths when possible
if command -v realpath >/dev/null 2>&1; then
  PROJECT_PATH="$(realpath "${PROJECT_PATH}")"
  STYLE_CHECK_PATH="$(realpath "${STYLE_CHECK_PATH}")"
else
  PROJECT_PATH="$(cd "${PROJECT_PATH}" && pwd)"
  STYLE_CHECK_PATH="$(cd "${STYLE_CHECK_PATH}" && pwd)"
fi

if [[ ! -d "${PROJECT_PATH}" ]]; then
  echo "Error: project path does not exist: ${PROJECT_PATH}" >&2
  exit 1
fi
if [[ ! -d "${STYLE_CHECK_PATH}" ]]; then
  echo "Error: StyleCheck path does not exist: ${STYLE_CHECK_PATH}" >&2
  exit 1
fi

find_register_cli() {
  if [[ -n "${REGISTER_CLI}" && -f "${REGISTER_CLI}" ]]; then
    echo "${REGISTER_CLI}"
    return 0
  fi

  local candidates=(
    "${PKG_ROOT}/node_modules/@winccoa-tools-pack/npm-winccoa-register-project/dist/cjs/cli.js"
    "${PKG_ROOT}/../npm-winccoa-register-project/dist/cjs/cli.js"
    "${PKG_ROOT}/../npm-winccoa-register-project/dist/src/cli.js"
  )
  local c
  for c in "${candidates[@]}"; do
    if [[ -f "${c}" ]]; then
      echo "${c}"
      return 0
    fi
  done

  if command -v npm-winccoa-register >/dev/null 2>&1; then
    echo "npm-winccoa-register"
    return 0
  fi

  return 1
}

run_cmd() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

REGISTER_BIN="$(find_register_cli)" || {
  echo "Error: could not find npm-winccoa-register-project CLI." >&2
  echo "Install @winccoa-tools-pack/npm-winccoa-register-project or pass --register-cli." >&2
  exit 1
}

echo "StyleCheck (non-runnable): ${STYLE_CHECK_PATH}"
echo "Worker project (runnable): ${PROJECT_PATH}"
echo "WinCC OA version: ${VERSION}"
echo "Langs: ${LANGS}"
echo "Register CLI: ${REGISTER_BIN}"

# 1) StyleCheck non-runnable
if [[ "${REGISTER_BIN}" == *.js ]]; then
  run_cmd node "${REGISTER_BIN}" \
    --project-path "${STYLE_CHECK_PATH}" \
    --runnable false \
    --wincc-oa-version "${VERSION}"
else
  run_cmd "${REGISTER_BIN}" \
    --project-path "${STYLE_CHECK_PATH}" \
    --runnable false \
    --wincc-oa-version "${VERSION}"
fi

# 2) Worker runnable + StyleCheck sub-project
# Note: register-project only writes config when missing. For a forced rewrite
# use: winccoa-ctrl-style register <projectPath> -v <ver>
if [[ "${REGISTER_BIN}" == *.js ]]; then
  run_cmd node "${REGISTER_BIN}" \
    --project-path "${PROJECT_PATH}" \
    --runnable true \
    --langs "${LANGS}" \
    --wincc-oa-version "${VERSION}" \
    --sub-project "${STYLE_CHECK_PATH}"
else
  run_cmd "${REGISTER_BIN}" \
    --project-path "${PROJECT_PATH}" \
    --runnable true \
    --langs "${LANGS}" \
    --wincc-oa-version "${VERSION}" \
    --sub-project "${STYLE_CHECK_PATH}"
fi

echo "Done."
echo "Worker config: ${PROJECT_PATH}/config/config"
echo "Next: winccoa-ctrl-style check \"${PROJECT_PATH}\" -v ${VERSION} --no-register"
#!/usr/bin/env bash
# Example only: not tested against a live SonarQube instance.
# Run from the checkout root on an agent with WinCC OA, npm and sonar-scanner.
set -euo pipefail

: "${STYLE_PACKAGE_VERSION:?Set a package release with SARIF support}"
: "${SONAR_PROJECT_KEY:?Set the existing SonarQube project key}"
: "${SONAR_HOST_URL:?Set the SonarQube server URL}"
: "${SONAR_TOKEN:?Provide the token through the CI secret environment}"

mkdir -p .artifacts
style_status=0
npx --yes \
  "@winccoa-tools-pack/npm-winccoa-ctrl-code-style@${STYLE_PACKAGE_VERSION}" \
  check ./src/Squirt -v 3.21 \
  --report-format sarif \
  --report-file .artifacts/ctl-style.sarif \
  --report-root "$PWD" \
  > .artifacts/ctl-style.log 2>&1 || style_status=$?
cat .artifacts/ctl-style.log

if [ ! -f .artifacts/ctl-style.sarif ]; then
  echo 'No report generated; inspect the style log. SonarQube import was skipped.' >&2
  exit 2
fi

scan_status=0
sonar-scanner \
  "-Dsonar.projectKey=${SONAR_PROJECT_KEY}" \
  "-Dsonar.projectBaseDir=${PWD}" \
  -Dsonar.sources=src/Squirt \
  -Dsonar.sarifReportPaths=.artifacts/ctl-style.sarif \
  -Dsonar.sourceEncoding=UTF-8 || scan_status=$?

if [ "$scan_status" -ne 0 ]; then
  exit "$scan_status"
fi
exit "$style_status"
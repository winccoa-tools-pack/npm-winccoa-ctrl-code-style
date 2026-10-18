# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-10-18

### Added

- add support for blacklisting files and generating reports (#32)
- add CTL style check package first draft

### Fixed

- clarify empty astyle --formatted stdout as clean style (#17)
- durable StyleCheck path and absolute CTL source scan (#14)

### Changed

- upmerge main to develop (#16)
- deps-dev(deps-dev): bump typescript-eslint from 8.71.0 to 8.71.1 (#31)
- deps-dev(deps-dev): bump @types/node (#29)
- deps-dev(deps-dev): bump typescript-eslint from 8.70.1 to 8.71.0 (#26)
- deps-dev(deps-dev): bump @types/node (#25)
- deps-dev(deps-dev): bump brace-expansion from 1.1.18 to 1.1.21 (#28)
- deps-dev(deps-dev): bump globals from 17.12.0 to 17.13.0 (#27)
- deps-dev(deps-dev): bump typescript-eslint from 8.70.0 to 8.70.1 (#22)
- deps-dev(deps-dev): bump prettier (#21)
- deps-dev(deps-dev): bump @types/node (#20)
- deps-dev(deps-dev): bump tsx from 4.23.13 to 4.23.15 (#23)
- deps-dev(deps-dev): bump prettier (#19)
- deps-dev(deps-dev): bump @types/node in the testing group (#18)
- deps-dev(deps-dev): bump typescript-eslint from 8.69.0 to 8.70.0 (#8)
- deps-dev(deps-dev): bump @types/node (#4)
- sync .github settings and workflows from template (#10)
- deps-dev(deps-dev): bump globals from 17.11.0 to 17.12.0
- fix MD036 headings in VISION.md
- style-fix
- Initial commit

## [Unreleased]

### Added

- SARIF 2.1.0 and GitLab Code Quality report exporters, original-line findings,
  portable paths, fingerprints and DevOps integration examples.
- Blacklist file/directory exclusions for check and format through repeatable
  `--blacklist`, `--blacklist-file` and corresponding API options.
- Unified original/formatted diffs in CLI output and API results, enabled by
  default with `--no-diff` to disable. Failing checks format temporary copies
  without modifying source files.
- Skipped-file reporting, line-ending diagnostics and native integration tests.

## [0.1.2] - 2026-09-16

### Fixed

- Materialize StyleCheck to a durable workspace path so worker `proj_path`
  remains valid across fresh Docker containers in CI
- Pass absolute source paths into `astyle.ctl`; normalize with
  `makeNativePath` and validate with `isdir` before
  `getFileNamesRecursive`
- Cast numeric/bool values in astyle log strings; fail when no CTL files
  are found under the source tree

### Changed

- Style registration prefers durable StyleCheck copies over transient
  `node_modules` / `/tmp` package installs

## [0.1.1] - 2026-09-16

### Added

- add CTL style check package first draft

### Changed

- deps-dev(deps-dev): bump typescript-eslint from 8.69.0 to 8.70.0 (#8)
- deps-dev(deps-dev): bump @types/node (#4)
- sync .github settings and workflows from template (#10)
- deps-dev(deps-dev): bump globals from 17.11.0 to 17.12.0
- fix MD036 headings in VISION.md
- style-fix
- Initial commit

## [0.1.0] - 2026-09-15

### Added

- Initial CTL style check/format package with CLI `winccoa-ctrl-style`
- Bundled non-runnable WinCC OA subproject `winccoa/StyleCheck` and `astyle.ctl`
  (scripts only; no `config/` or `log/` on StyleCheck)
- Worker-project model: register StyleCheck, then runnable source with `--sub-project`
- WCCOActrl invocation via `-config <worker>/config/config` (logs stay on worker)
  and bare script name `astyle.ctl` (not a full path)
- `register` CLI command and local helpers:
  - `scripts/register-stylecheck-projects.sh`
  - `scripts/register-stylecheck-projects.ps1`
- astyle.config resolved via `getPath` (worker / StyleCheck / OA install)
- Product and development vision documents (VISION.md, docs/dev/VISION.md)

### Notes

- No CLI `--options` path; place custom `astyle.config` in the worker project when needed

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

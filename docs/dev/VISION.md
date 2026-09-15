# Development Vision — npm-winccoa-ctrl-code-style

## Vision statement

Ship a small, CI-ready CTL style check/format tool that runs **real** WinCC OA
CTRL (`WCCOActrl` + `astyle.ctl`) with the **worker project as runtime context**
and **StyleCheck as a non-runnable sub-project**.

Root product intent: see [`VISION.md`](../../VISION.md).

---

## Core objectives

1. **Correct project topology** — StyleCheck non-runnable; worker runnable +
   `--sub-project StyleCheck`.
2. **Correct CTRL invocation** — `WCCOActrl -config <worker>/config/config ...`
   (not `-proj StyleCheck` as primary).
3. **CI/CD ready** — exit `0` on success, non-zero on style failures / tool errors.
4. **Local parity** — shell + PowerShell register helpers usable on a laptop.
5. **Composable** — build on `npm-winccoa-core` and `npm-winccoa-register-project`.
6. **Actionable logs** — `throwError(makeError(...))` from `astyle.ctl` for later
   Action/PR reporting.

---

## Architecture principles

### 1. Worker-first runtime

The source project under test is the workplace. StyleCheck only contributes
scripts (and optionally shared config assets) through `proj_path` search order.

### 2. Registration is a first-class step

Do not hide registration in ad-hoc shell. Prefer:

- in-process `registerWorkerProjectWithStyleCheck()`
- CLI `winccoa-ctrl-style register`
- `scripts/register-stylecheck-projects.sh|.ps1` calling register-project

### 3. Path search over option flags

`astyle.config` is resolved inside CTL via `getPath(CONFIG_REL_PATH, "astyle.config")`
(worker → sub-projects → OA install). Users who need a custom style drop the
file into the worker project.

### 4. Type safety and lean API

- Strong public types (`StyleCheckOptions`, `StyleCheckResult`)
- No `any` in public surface
- Small CLI: `check` | `format` | `register`

### 5. Testability

- Unit tests for argv parsing and `-config` arg construction without OA
- Integration smoke for `--help`
- Optional local OA smoke against a tiny fixture project

---

## Package structure

```text
src/
  cli.ts            # winccoa-ctrl-style entry
  style-check.ts    # CtrlComponent + buildCtrlArgs (-config)
  register.ts       # StyleCheck + worker registration
  paths.ts          # package / StyleCheck path resolution
  types.ts          # public types
  index.ts          # exports
winccoa/StyleCheck/
  scripts/astyle.ctl
scripts/
  register-stylecheck-projects.sh
  register-stylecheck-projects.ps1
VISION.md           # product vision (source of truth)
docs/dev/VISION.md  # this development vision
```

---

## Technology stack

- **Language**: TypeScript 5.x
- **Runtime**: Node.js 20+
- **Build**: `tsc` → `dist/cjs`, `dist/esm`, declaration emit
- **Tests**: `node:test` + `tsx`
- **Deps**: `@winccoa-tools-pack/npm-winccoa-core`,
  `@winccoa-tools-pack/npm-winccoa-register-project`
- **Quality**: ESLint, Prettier, markdownlint
- **CI**: GitHub Actions (org patterns)

---

## API design philosophy

1. **One job** — CTL style check/format via OA astyle.
2. **Exit codes are the contract** — CI must not need log scraping to know fail.
3. **Registration optional but default-on** — `--no-register` when config already
   prepared by helper scripts or prior step.
4. **Script name is enough** — with StyleCheck on `proj_path`, CTRL receives
   only `astyle.ctl` (relative to `scripts/`), never a full filesystem path.

### Preferred process shape

```text
register StyleCheck (non-runnable)
register worker (runnable, sub-project=StyleCheck)
WCCOActrl -config <worker>/config/config -n -log +stderr astyle.ctl <source> [TRUE]
```

---

## Development workflow

1. Branch from `develop`
2. Keep changes minimal and vision-aligned (worker-first)
3. Update unit tests for CLI/args
4. Update `CHANGELOG.md` / docs when behavior changes
5. PR to `develop`

### Release notes expectation

PR titles stay imperative; changelog entries must mention registration or
invocation changes explicitly when the project model is touched.

---

## Quality bar

- Public API documented (TSDoc)
- Unit tests for parse/build helpers
- No UTF-8 BOM on `.ctl` sources
- Helper scripts published in package `files` for local/CI use
- Do not regress to StyleCheck-as-primary-project shortcuts

---

## Roadmap (dev view)

### v0.1.0 (current target)

- Worker + StyleCheck sub-project model
- CLI check/format/register
- Local sh/ps1 register helpers
- OA-default astyle.config via getPath

### Next

- GitHub Action thin wrapper
- Log-line → annotation pipeline (consume throwError output)
- Fixture-based optional OA integration test in CI images

### Later

- Org-standard quality gates only as consumers, not by absorbing unrelated tools

---

## Contribution guardrails

- Reject changes that make StyleCheck the log/artifact owner again
- Reject mandatory CLI `--options` unless a proven gap appears
- Prefer extending register-project over forking registration semantics
- Keep the package small enough to reason about in one PR

---

<center>Made with ❤️ for and by the WinCC OA community</center>

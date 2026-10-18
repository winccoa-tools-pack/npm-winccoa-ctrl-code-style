# npm-winccoa-ctrl-code-style

Check and format WinCC OA **CTL** sources using `WCCOActrl` and the bundled
non-runnable **StyleCheck** subproject (`astyle.ctl`).

## Vision

Product intent and the non-negotiable worker + StyleCheck project model are
documented in [VISION.md](./VISION.md). Development detail lives in
[docs/dev/VISION.md](./docs/dev/VISION.md).

## Correct project model

1. Register **StyleCheck** as a **non-runnable** WinCC OA project.
2. Register the **worker / source project** (e.g. Squirt) as **runnable**, with
   StyleCheck attached via `--sub-project StyleCheck`
   (`@winccoa-tools-pack/npm-winccoa-register-project`).
3. Start CTRL against the **worker** config (not `-proj StyleCheck`):

```text
WCCOActrl -config <worker>/config/config -n -log +stderr astyle.ctl <source> [TRUE]
```

Why this is correct:

- The worker project owns logs and artifacts (not StyleCheck).
- `getPath` resolves scripts from StyleCheck as a sub-project.
- Optional custom `astyle.config` lives under the worker `config/` (or OA default).
  No CLI `--options` flag is needed.

## Install

```bash
npm install @winccoa-tools-pack/npm-winccoa-ctrl-code-style
```

## CLI

```bash
# Register only (StyleCheck + worker with sub-project)
winccoa-ctrl-style register ./src/Squirt -v 3.21

# Dry-run check (registers first by default)
winccoa-ctrl-style check ./src/Squirt -v 3.21

# Format in place
winccoa-ctrl-style format ./src/Squirt -v 3.21

# Scan a subtree only
winccoa-ctrl-style check ./src/Squirt -v 3.21 -s ./src/Squirt/scripts
```

## Blacklist

Exclude exact files or whole directories from both `check` and `format`:

```bash
winccoa-ctrl-style check ./src/Squirt -v 3.21 --blacklist ./src/Squirt/scripts/gedi/projectView.ctl
winccoa-ctrl-style format ./src/Squirt -v 3.21 --blacklist ./vendor --blacklist ./generated
winccoa-ctrl-style check ./src/Squirt -v 3.21 --blacklist-file .ctl-style-blacklist
```

`--blacklist` is repeatable. Its paths resolve relative to the current working
directory, or may be absolute. Matching is by exact file path or directory
descendant, not by glob or substring. Quote paths containing spaces.

`--blacklist-file` reads a UTF-8 file with one path per line. Empty lines and
lines starting with `#` are ignored. Entries resolve relative to the blacklist
file's directory, so a list committed at the repository root can contain:

```text
# Temporary exception while investigating cross-platform formatting
src/Squirt/scripts/gedi/projectView.ctl
vendor
```

Skipped CTL files are logged as `SKIPPED-BLACKLIST` and returned in
`result.skippedFiles`. If every CTL file is excluded, the run succeeds without
starting the formatter. A missing/unreadable blacklist file is an error.
Directory symlinks are not followed during source discovery.

## Formatter Diffs

Unified diffs are printed by default for files that need formatting (`check`)
or were changed (`format`). The `original` and `formatted` headers identify
the two versions. Line-ending counts make otherwise invisible CRLF/LF-only
changes explicit. Unchanged files produce no diff.

Check mode never modifies source files: when a check fails, the package formats
temporary copies using the same worker configuration and compares their content
with the originals. Temporary files are removed afterward, including on errors.
This diagnostic pass adds a second CTRL launch to failing checks. The original
check exit code is preserved; a failure to generate diffs is reported separately.

Use `--no-diff` (API: `showDiff: false`) to disable snapshots and the diagnostic
pass. The API returns unified patches in `result.diff`; the CLI prints them to
stdout so CI can retain them in its captured style log. No external `git` or
`diff` executable is required.

## CI Reports

Export **SARIF 2.1.0** for GitHub code scanning and Jenkins Warnings NG, or
**GitLab Code Quality JSON** for native GitLab merge-request reporting:

```bash
winccoa-ctrl-style check ./src/Squirt -v 3.21 --report-format sarif --report-file .artifacts/ctl-style.sarif --report-root .
winccoa-ctrl-style check ./src/Squirt -v 3.21 --report-format gitlab --report-file gl-code-quality-report.json --report-root .
```

Reports contain original-source locations, portable checkout-relative paths,
stable fingerprints and a formatting finding per changed region. Blacklisted
files are omitted. Clean checks write empty reports; execution failures do not
produce misleading clean reports. Existing report artifacts are removed at run
start. `--no-diff` suppresses console patches but not report generation.

Read the [DevOps reporting guide](docs/devops-reporting.md) for API usage,
release prerequisites, exit-code handling, permissions and publication details.
Adapt the [GitHub workflow](examples/github-sarif.yml),
[GitLab CI job](examples/gitlab-code-quality.yml),
[Jenkins pipeline](examples/Jenkinsfile),
[Azure pipeline](examples/azure-pipelines-sarif.yml), or
[SonarQube import script](examples/sonarqube-sarif.sh) for your environment.
The Azure and SonarQube configurations are **example only**, not validated
against live services. Read the guide's SonarQube classification and file-indexing
caveats before enabling import.

## Local registration helpers

Shell (Linux / Git Bash / CI):

```bash
./scripts/register-stylecheck-projects.sh \
  --project-path ./src/Squirt \
  --version 3.21 \
  --langs en_US.utf8
```

PowerShell (Windows local):

```powershell
./scripts/register-stylecheck-projects.ps1 `
  -ProjectPath ./src/Squirt `
  -Version 3.21
```

Both helpers call `npm-winccoa-register-project`:

1. `--project-path <StyleCheck> --runnable false`
2. `--project-path <worker> --runnable true --sub-project <StyleCheck>`

> Note: the register-project CLI only **writes** worker `config` when it does
> not already exist. For a forced config rewrite that always injects StyleCheck,
> use `winccoa-ctrl-style register <projectPath> -v <ver>` (in-process API).

## API

```ts
import {
  checkStyle,
  formatStyle,
  registerWorkerProjectWithStyleCheck,
} from '@winccoa-tools-pack/npm-winccoa-ctrl-code-style';

await registerWorkerProjectWithStyleCheck({
  projectPath: './src/Squirt',
  version: '3.21',
});

const result = await checkStyle({
  projectPath: './src/Squirt',
  version: '3.21',
  registerProject: false,
  blacklist: ['./src/Squirt/scripts/gedi/projectView.ctl'],
  // Alternatively: blacklistFile: './.ctl-style-blacklist',
  showDiff: true,
});

console.log(result.diff);
console.log(result.skippedFiles);
```

## StyleCheck layout

```text
winccoa/StyleCheck/
  scripts/astyle.ctl
```

StyleCheck is **non-runnable**. It has no `config/` or `log/`. The worker
project owns `config/config` and logs when CTRL runs with `-config`.

## Development

```bash
npm ci
npm run build
npm run test:unit
```

The native integration test is opt-in and reuses an existing registered worker
with this checkout's StyleCheck subproject on its search path. It does not
register projects or rewrite the worker config:

```powershell
$env:WINCCOA_STYLE_TEST_PROJECT = 'C:\path\to\registered-worker'
$env:WINCCOA_STYLE_TEST_VERSION = '3.21'
npm run test:integration
```

Source fixtures are created in a temporary directory and removed afterward.
Without `WINCCOA_STYLE_TEST_PROJECT`, the native test is skipped.

---

<center>Made with ❤️ for and by the WinCC OA community</center>

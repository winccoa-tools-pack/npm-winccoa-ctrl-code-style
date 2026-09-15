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
});
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

---

<center>Made with ❤️ for and by the WinCC OA community</center>

# VISION — npm-winccoa-ctrl-code-style

Provide a minimal, reliable, and well-documented Node.js helper that checks and
formats WinCC OA **CTL** sources with the real WinCC OA toolchain (`WCCOActrl` +
`astyle`), in a way that is correct for both **local development** and **CI**.

This is intentionally the first small **CTRL-in-NPM** package in the ecosystem:
registration and execution follow real project rules, not a shell shortcut that
pretends StyleCheck is the worker.

## What success looks like

- Engineers can run `winccoa-ctrl-style check|format <workerProject>` and get a
  deterministic exit code (`0` success, non-zero failure).
- CI can consume the same CLI / API without a special “fake project” path.
- Logs and artifacts live on the **source / worker project** (e.g. Squirt), not
  locked inside the StyleCheck sub-project after the run.
- Optional project-local `astyle.config` is discovered via WinCC OA path search
  (`getPath`), without a CLI options-file flag.

## Correct WinCC OA project model (non-negotiable)

1. **StyleCheck** is a bundled **non-runnable** WinCC OA sub-project that only
   carries `scripts/astyle.ctl` (and related StyleCheck assets).
2. The **worker project** is the runnable source project under test
   (for example `src/Squirt`). It owns config, logs, and artifacts.
3. Registration is done with
   `@winccoa-tools-pack/npm-winccoa-register-project`:
   - register StyleCheck: `--runnable false`
   - register worker: `--runnable true --sub-project <StyleCheck>`
4. CTRL is started against the **worker config**, not against StyleCheck as
   primary project:

```text
WCCOActrl -config <worker>/config/config -n -log +stderr astyle.ctl <source> [TRUE]
```

`-config` is preferred over `-proj <name>` because it is exact, reproducible,
and keeps the worker project as the runtime context.

### Why this is the correct way

| Concern | Wrong approach | Correct approach |
| --- | --- | --- |
| Runtime project | StyleCheck is primary (`-proj StyleCheck`) | Worker is primary (`-config worker/config/config`) |
| Logs / artifacts | End up under StyleCheck | Stay under the worker / source project |
| Script resolution | Only StyleCheck paths | StyleCheck is a `proj_path` sub-project; `getPath` finds `astyle.ctl` |
| Style rules | Force a package/CLI options path | `astyle.config` via `getPath` (worker → StyleCheck → OA install) |
| Registration | Ad-hoc shell / pmon hacks | `npm-winccoa-register-project` (+ local helper scripts) |

## Scope

**In scope**

- Dry-run style **check** and in-place **format** for `*.ctl` trees.
- Bundled StyleCheck sub-project + `astyle.ctl` using `throwError(makeError(...))`
  log lines (for later GH Action / PR reporting).
- Programmatic registration helpers and CLI `register`.
- Local/CI helper scripts:
  - `scripts/register-stylecheck-projects.sh`
  - `scripts/register-stylecheck-projects.ps1`
- Clear TypeScript API and `winccoa-ctrl-style` CLI.
- Composition with existing packages (`npm-winccoa-core`,
  `npm-winccoa-register-project`).

**Out of scope (for this package)**

- Creating full WinCC OA application projects from scratch.
- Panel/PNL formatting or non-CTL style tools.
- Full static analysis / CtrlPPCheck (separate quality gate).
- Deep PR annotation UX (may consume logs later via Actions; not this package’s
  core job in v0.1).
- Replacing WinCC OA’s shipped `astyle` binary or default config distribution.

## Audience

- WinCC OA automation engineers enforcing CTL style in CI.
- Maintainers of packages / subprojects such as Squirt / GUI test frameworks.
- Authors of GitHub Actions that need a stable, project-correct style step.
- AI agents that must register and run CTRL tools without inventing project
  topology.

## Design principles

1. **Worker owns the run** — source project is the runnable context.
2. **StyleCheck is a library sub-project** — ships script(s), not the workplace.
3. **Register for real** — use the register-project package/CLI, not one-off
   shell registration.
4. **Prefer `-config`** — pin the exact worker config path.
5. **Lean composition** — small package; depend on core + register-project.
6. **Deterministic CI behavior** — stable exit codes; actionable CTRL logs.
7. **No required custom options CLI** — path search for `astyle.config` is enough;
   advanced users drop a file into the worker project when needed.
8. **Local parity** — same helpers work on a laptop and in runners.

## Relationship to sibling tools

```text
npm-winccoa-core                 process / path / ProjEnv primitives
        ^
        |
npm-winccoa-register-project     config write + (un)register + --sub-project
        ^
        |
npm-winccoa-ctrl-code-style      StyleCheck sub-project + astyle.ctl + CLI/API
        ^
        |
GitHub Action / repo workflows   call register helpers + check/format
```

Syntax-check and other CTRL tools should follow the same worker-first pattern
where applicable (`-config` on the project under test).

## Near-term product direction

- **v0.1** — solid local/CI CLI: register → check/format with worker `-config`.
- **Next** — GitHub Action wrapper that reuses this package (no duplicate shell
  registration logic).
- **Next** — optional consumption of `throwError` log lines for PR annotations.
- **Later** — tighter alignment with org quality gates (coverage, markdown,
  changelog) without growing this package into a monolith.

## Non-goals / anti-patterns to avoid

- Treating StyleCheck as the runnable project “because the script lives there”.
- Re-introducing a mandatory `--options` CLI just to pass astyle config.
- Bypassing `npm-winccoa-register-project` with hand-written `pvssInst` edits in
  Actions when the package already exists.
- Writing logs into the tool package directory as the primary output location.

---

<center>Made with ❤️ for and by the WinCC OA community</center>

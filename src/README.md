# Source layout

- `cli.ts` — CLI (`winccoa-ctrl-style` check|format|register)
- `style-check.ts` — run WCCOActrl with `-config` against worker project
- `register.ts` — StyleCheck + worker registration (sub-project model)
- `paths.ts` — resolve bundled `winccoa/StyleCheck`
- `types.ts` — public option/result types

Helpers (repo root `scripts/`):

- `register-stylecheck-projects.sh`
- `register-stylecheck-projects.ps1`

# DevOps Reporting

## Release Prerequisites

SARIF and GitLab Code Quality reporting require a new package release; they are
not included in published version 0.1.2. Pin a supporting version in production.
The examples use `STYLE_PACKAGE_VERSION` or a repository variable so operators
can select that release without changing the example scripts. Do not use a Git
branch name as an npm version.

See the [release prerelease guide](release-prereleases.md) for candidate creation,
base-version matching and rollout of workflow changes.

Use an approved image or agent with WinCC OA, Node.js/npm and the necessary
license/access configuration. Register the worker and StyleCheck in the same
host/container that runs the check. The worker is runnable; StyleCheck is not.
Examples assume the source project is `src/Squirt`; adapt this to your checkout.

## CLI and API

Run from the checkout root:

```bash
npx --yes "@winccoa-tools-pack/npm-winccoa-ctrl-code-style@${STYLE_PACKAGE_VERSION}" check ./src/Squirt -v 3.21 --report-format sarif --report-file .artifacts/ctl-style.sarif --report-root .
npx --yes "@winccoa-tools-pack/npm-winccoa-ctrl-code-style@${STYLE_PACKAGE_VERSION}" check ./src/Squirt -v 3.21 --report-format gitlab --report-file gl-code-quality-report.json --report-root .
```

`--report-format` and `--report-file` must be supplied together. Supported formats
are `sarif` and `gitlab`. `--report-root` defaults to the CLI working directory;
set it explicitly when launching outside the checkout. Sources with findings
outside that root are rejected instead of emitting nonportable paths.

The output path is an owned, generated artifact: existing content is removed at
the start of each run. Never point it at a source/config file. Parent directories
are created automatically. One report format can be written per invocation.
API consumers can export both formats from a single analysis:

```typescript
import { checkStyle, writeReport } from '@winccoa-tools-pack/npm-winccoa-ctrl-code-style';

const result = await checkStyle({
  projectPath: './src/Squirt',
  version: '3.21',
  reportRoot: process.cwd(),
  reportFormat: 'sarif',
  reportFile: '.artifacts/ctl-style.sarif',
});
writeReport('gitlab', '.artifacts/gl-code-quality-report.json', result.findings);
process.exitCode = result.success ? 0 : 2;
```

## Findings Contract

- One finding per contiguous formatting region, at an original-source line.
- Rule ID: `winccoa.astyle.Formatting`; SARIF severity `warning`, GitLab `minor`.
- Message: formatting differs from configured astyle rules. Astyle does not
  identify individual rules such as indentation or spacing.
- Paths are checkout-relative, forward-slash separated, without `./` or temporary
  copy paths. SARIF paths are URI-encoded; GitLab paths remain plain strings.
- Fingerprints hash rule, path, changed content and duplicate occurrence, not
  absolute paths or line numbers. Changes to a region may change its fingerprint.
- Blacklisted files are omitted. Clean/all-excluded runs write valid empty
  reports. Reports are UTF-8 without a BOM.
- `format` reports the changes it applied, not remaining violations. Use `check`
  for CI quality gates and baseline comparisons.

Report generation works with `--no-diff`; a failing check still needs temporary
formatted copies to locate findings. The full unified diff remains in the log
unless disabled. Keep logs as separate artifacts for troubleshooting.

## Exit Codes and Failures

CLI exit codes remain `0` for success, `1` for usage errors and `2` for a failed
style operation or execution error. Formatting findings produce a report before
the check returns failure. Report creation does not bypass the quality gate.

Infrastructure errors, timeouts, formatter failures, or failed checks without
confirmed formatting changes must not be presented as clean scans. Such failures
remove the stale artifact and do not write a replacement. Upload a report only
when it exists; retain the log and fail the job when execution fails. Do not
manufacture `[]` as an error fallback.

## GitHub

Use [github-sarif.yml](../examples/github-sarif.yml) as a workflow template. Set
repository variables `STYLE_PACKAGE_VERSION` and `WINCCOA_IMAGE`, grant GHCR
package access to the repository, and authenticate for private images.

The action accepts `report-format: sarif` and a checkout-relative `report-path`.
Its `report-path` output is the absolute host path only if a report was generated,
including when the style operation found violations. Docker writes into the
mounted checkout, so the artifact survives container removal.

Upload with `github/codeql-action/upload-sarif@v4` and `security-events: write`.
Private/internal repositories need GitHub Code Security enabled. Fork PR token
permissions may prevent upload; do not grant untrusted code access to secrets
using `pull_request_target`. Artifact download is the fallback when code scanning
is unavailable. Use a distinct upload category per independently scanned subtree.

The example publishes before enforcing the final style gate. The action and npm
release must both support reporting; updating just one is insufficient.

## GitLab

Use [gitlab-code-quality.yml](../examples/gitlab-code-quality.yml) as a CI template.
Set `WINCCOA_STYLE_IMAGE` to an accessible WinCC OA image with Node.js/npm and
`STYLE_PACKAGE_VERSION` to the supporting npm release. Configure registry
authentication with your normal protected CI settings, not inline credentials.

Declare `artifacts:reports:codequality` pointing at the generated JSON file and
retain logs using `artifacts:when:always`. Run analysis on the target/default
branch as well as merge requests: GitLab needs a baseline to identify new and
resolved findings. Feature visibility varies by GitLab tier/version. This uses
direct report import, not the deprecated CodeClimate scanner template.

## Jenkins

Use [Jenkinsfile](../examples/Jenkinsfile) on a Linux agent with WinCC OA and Node.
Set `STYLE_PACKAGE_VERSION` in the job environment. Warnings Next Generation has
a built-in `sarif` parser; no custom parser or Checkstyle conversion is required.

Publish in `post { always { ... } }` with `enabledForFailure: true`, since style
checks intentionally fail when violations exist. Keep the original failure
status and archive the SARIF and log. Missing reports are execution errors, not
zero-warning results. Configure Jenkins quality gates separately if desired.

## Azure DevOps

The [Azure Pipelines example](../examples/azure-pipelines-sarif.yml) is
**example only: not tested against a live Azure DevOps instance**. Adapt its
self-hosted Linux agent pool, package version and WinCC OA version. The agent
needs WinCC OA, Node.js/npm, Bash and your normal project/license configuration.

The check preserves its failure exit code, while `condition: always()` publishes
the SARIF and diagnostic log under the `CodeAnalysisLogs` build artifact. A
missing report indicates an execution error; do not replace it with an empty
report. The log directory can still be published for diagnosis.

Artifact publication alone does not create inline pull-request annotations.
For visualization, evaluate the SARIF SAST Scans Tab marketplace extension and
verify its compatibility with your Azure DevOps Services or Server version.
Use an approved extension version and follow its artifact naming/configuration
requirements; `CodeAnalysisLogs` is used by this example. No extension or Azure
service connection is installed or configured by this package.

## SonarQube

The [SonarQube import script](../examples/sonarqube-sarif.sh) is
**example only: not tested against a live SonarQube instance**. It generates
SARIF, then runs SonarScanner with
`sonar.sarifReportPaths=.artifacts/ctl-style.sarif`. It still runs analysis when
formatting violations exist, but skips import if execution produced no report.
Scanner failures take precedence; otherwise the original style exit status is
returned. Successful scanner submission is not proof that the server imported
every finding or that a SonarQube quality gate passed.

Run from the checkout root with WinCC OA, Node.js/npm and SonarScanner installed.
Provide `STYLE_PACKAGE_VERSION`, `SONAR_PROJECT_KEY` and `SONAR_HOST_URL` through
the CI environment. Supply `SONAR_TOKEN` as a masked secret environment variable;
do not commit it, echo it, or put it in command-line properties. Use a current
SonarScanner version supporting those environment variables. Retain `.artifacts`
using your platform's always-run artifact step even if the script fails.

Before enabling this example in production:

- Confirm your SonarQube Server version supports `sonar.sarifReportPaths` and
  SARIF 2.1.0; consult the documentation matching that installed version.
- Ensure reported `.ctl` files are indexed in the scanner's source scope and
  supported by your installed language/plugin configuration. Merely listing
  `sonar.sources` does not guarantee CTRL file indexing. Check scanner/server
  logs and verify a known test finding appears on the correct file.
- Current SonarQube documentation maps SARIF external issues to **Security**
  in MQR Mode and **Vulnerability** in Standard Experience. That classification
  may be unsuitable for formatting findings. Confirm it with your SonarQube
  administrator; do not treat formatting as evidence of a security defect.
  A Generic Issue Import exporter with an explicit Maintainability mapping
  would be a separate feature and is not implemented here.
- External rules remain managed by this tool; they do not become configurable
  SonarQube quality-profile rules. Preserve the CLI style gate separately.

## References

- [GitHub SARIF upload](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/uploading-a-sarif-file-to-github)
- [GitLab Code Quality](https://docs.gitlab.com/ci/testing/code_quality/)
- [Jenkins Warnings NG](https://www.jenkins.io/doc/pipeline/steps/warnings-ng/)
- [Azure Publish Build Artifacts task](https://learn.microsoft.com/en-us/azure/devops/pipelines/tasks/reference/publish-build-artifacts-v1)
- [SonarQube SARIF import](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/importing-external-issues/importing-issues-from-sarif-reports)

---

<center>Made with ❤️ for and by the WinCC OA community</center>

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CtrlComponent } from '@winccoa-tools-pack/npm-winccoa-core/types/components/implementations/CtrlComponent';
import type { StyleCheckOptions, StyleCheckResult } from './types';
import { getAstyleScriptPath, resolveStyleCheckProjectPath } from './paths';
import { registerWorkerProjectWithStyleCheck, resolveWinCCOAVersion } from './register';
import { collectSources, sourceDiff } from './sources';
import { formattingFindings, writeReport } from './reports';
import type { StyleFinding } from './reports';

const DEFAULT_TIMEOUT = 120_000;

/** Script name relative to StyleCheck scripts/ (OA proj_path resolution). */
export const ASTYLE_SCRIPT = 'astyle.ctl';

/**
 * Build WCCOActrl argv for astyle.ctl against the worker project config.
 *
 *   WCCOActrl -config <worker>/config/config -n -log +stderr astyle.ctl <source> [TRUE]
 *
 * Script is always the bare name `astyle.ctl` (resolved via StyleCheck on
 * proj_path). Worker project is runnable; logs stay on the worker.
 *
 * sourcePath must be an absolute path: CTL getFileNamesRecursive does not
 * resolve CWD-relative paths.
 */
export function buildCtrlArgs(options: {
    configPath: string;
    sourcePath: string;
    applyChanges: boolean;
    /** @default ASTYLE_SCRIPT (`astyle.ctl`) */
    scriptName?: string;
    fileListPath?: string;
}): string[] {
    const args = [
        '-config',
        options.configPath,
        '-n',
        '-log',
        '+stderr',
        options.scriptName ?? ASTYLE_SCRIPT,
        // Absolute path for CTL file APIs (native separators OK; CTRL makeNativePath too).
        path.resolve(options.sourcePath),
    ];

    if (options.applyChanges || options.fileListPath) {
        args.push(options.applyChanges ? 'TRUE' : 'FALSE');
    }
    if (options.fileListPath) {
        args.push(options.fileListPath);
    }

    return args;
}

/**
 * Run CTL style check or format via worker project + StyleCheck sub-project.
 */
export async function runStyleCheck(options: StyleCheckOptions): Promise<StyleCheckResult> {
    if (Boolean(options.reportFormat) !== Boolean(options.reportFile)) {
        throw new Error('reportFormat and reportFile must be specified together');
    }
    if (options.reportFormat && !['sarif', 'gitlab'].includes(options.reportFormat)) {
        throw new Error('reportFormat must be sarif or gitlab');
    }
    const reportFile = options.reportFile ? path.resolve(options.reportFile) : undefined;
    if (reportFile) fs.rmSync(reportFile, { force: true });
    const needsComparison = options.showDiff !== false || Boolean(options.reportFormat);
    const version = resolveWinCCOAVersion(options.version);
    // Always absolute: CTRL cannot use CWD-relative source trees.
    const projectPath = path.resolve(options.projectPath);
    const sourcePath = path.resolve(options.sourcePath ?? projectPath);
    const applyChanges = options.applyChanges === true;
    const styleCheckPath = resolveStyleCheckProjectPath({
        workerProjectPath: projectPath,
        styleCheckProjectPath: options.styleCheckProjectPath,
    });
    // Existence check only — CTRL receives bare script name, not this path.
    const bundledScriptPath = getAstyleScriptPath(styleCheckPath);
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;
    const registerProject = options.registerProject !== false;

    if (!fs.existsSync(projectPath)) {
        throw new Error(`projectPath does not exist: ${projectPath}`);
    }
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`sourcePath does not exist: ${sourcePath}`);
    }
    if (!fs.existsSync(bundledScriptPath)) {
        throw new Error(`astyle.ctl not found: ${bundledScriptPath}`);
    }

    let configPath = path.join(projectPath, 'config', 'config');

    if (registerProject) {
        const registered = await registerWorkerProjectWithStyleCheck({
            projectPath,
            version,
            langs: options.langs,
            styleCheckProjectPath: styleCheckPath,
            forceRewriteConfig: true,
        });
        configPath = registered.configPath;
    }

    if (!fs.existsSync(configPath)) {
        throw new Error(
            `Worker project config not found: ${configPath}. Register first ` +
                `(registerProject or scripts/register-stylecheck-projects.sh).`,
        );
    }

    // Prefer absolute config path for WCCOActrl -config.
    configPath = path.resolve(configPath);

    const { files, skipped } = collectSources(sourcePath, options.blacklist, options.blacklistFile);
    if (files.length === 0 && skipped.length === 0) {
        throw new Error(`No .ctl files found below ${sourcePath}`);
    }
    const skippedLog = skipped.map((filePath) => `SKIPPED-BLACKLIST: ${filePath}\n`).join('');
    const findings: StyleFinding[] = [];
    const base = {
        projectPath,
        sourcePath,
        configPath,
        applyChanges,
        skippedFiles: skipped,
        findings,
        reportFile,
    };
    if (files.length === 0) {
        if (options.reportFormat && reportFile)
            writeReport(options.reportFormat, reportFile, findings);
        return { ...base, success: true, exitCode: 0, stdout: skippedLog, stderr: '', diff: '' };
    }

    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'winccoa-style-'));
    try {
        const fileListPath = path.join(temporary, 'files.json');
        fs.writeFileSync(fileListPath, JSON.stringify(files));
        const originals = needsComparison
            ? files.map((filePath) => fs.readFileSync(filePath, 'utf8'))
            : [];
        const ctrl = new CtrlComponent();
        ctrl.setVersion(version);
        const exitCode = await ctrl.start(
            buildCtrlArgs({ configPath, sourcePath, applyChanges, fileListPath }),
            { timeout },
        );
        let diagnosticError = '';
        let formattedFiles = files;
        if (!applyChanges && exitCode !== 0 && needsComparison) {
            const copyRoot = path.join(temporary, 'sources');
            formattedFiles = files.map((filePath) => {
                const copy = path.join(copyRoot, path.relative(sourcePath, filePath));
                fs.mkdirSync(path.dirname(copy), { recursive: true });
                fs.copyFileSync(filePath, copy);
                return copy;
            });
            const copyList = path.join(temporary, 'copies.json');
            fs.writeFileSync(copyList, JSON.stringify(formattedFiles));
            const formatter = new CtrlComponent();
            formatter.setVersion(version);
            const formatCode = await formatter.start(
                buildCtrlArgs({
                    configPath,
                    sourcePath: copyRoot,
                    applyChanges: true,
                    fileListPath: copyList,
                }),
                { timeout },
            );
            if (formatCode !== 0) {
                diagnosticError = `\nUnable to generate formatter diff (exit ${formatCode}).\n${formatter.stdOut ?? ''}\n${formatter.stdErr ?? ''}`;
            }
        }
        if (options.reportFormat && reportFile) {
            if (
                diagnosticError ||
                (exitCode !== 0 && exitCode !== 1) ||
                (applyChanges && exitCode !== 0)
            ) {
                throw new Error(
                    'Cannot generate a reliable report: formatter execution failed.' +
                        diagnosticError,
                );
            }
            if (applyChanges || exitCode !== 0) {
                for (const [index, filePath] of files.entries()) {
                    findings.push(
                        ...formattingFindings(
                            filePath,
                            originals[index],
                            fs.readFileSync(formattedFiles[index], 'utf8'),
                            options.reportRoot ?? process.cwd(),
                        ),
                    );
                }
            }
            if (exitCode !== 0 && findings.length === 0) {
                throw new Error(
                    'Style check failed without confirmed formatting changes; no report generated.\n' +
                        (ctrl.stdErr ?? ''),
                );
            }
            writeReport(options.reportFormat, reportFile, findings);
        }
        const diff =
            options.showDiff !== false && !diagnosticError && (applyChanges || exitCode !== 0)
                ? files
                      .map((filePath, index) =>
                          sourceDiff(
                              filePath,
                              originals[index],
                              fs.readFileSync(formattedFiles[index], 'utf8'),
                          ),
                      )
                      .join('\n')
                : '';
        return {
            ...base,
            success: exitCode === 0,
            exitCode,
            stdout: skippedLog + (ctrl.stdOut ?? ''),
            stderr: (ctrl.stdErr ?? '') + diagnosticError,
            diff,
        };
    } finally {
        fs.rmSync(temporary, { recursive: true, force: true });
    }
}

/**
 * Dry-run style check (no file changes).
 */
export async function checkStyle(
    options: Omit<StyleCheckOptions, 'applyChanges'>,
): Promise<StyleCheckResult> {
    return runStyleCheck({ ...options, applyChanges: false });
}

/**
 * Format CTL sources in place.
 */
export async function formatStyle(
    options: Omit<StyleCheckOptions, 'applyChanges'>,
): Promise<StyleCheckResult> {
    return runStyleCheck({ ...options, applyChanges: true });
}

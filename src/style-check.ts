import fs from 'node:fs';
import path from 'node:path';
import { CtrlComponent } from '@winccoa-tools-pack/npm-winccoa-core/types/components/implementations/CtrlComponent';
import type { StyleCheckOptions, StyleCheckResult } from './types';
import { getAstyleScriptPath, getDefaultStyleCheckProjectPath } from './paths';
import { registerWorkerProjectWithStyleCheck, resolveWinCCOAVersion } from './register';

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
 */
export function buildCtrlArgs(options: {
    configPath: string;
    sourcePath: string;
    applyChanges: boolean;
    /** @default ASTYLE_SCRIPT (`astyle.ctl`) */
    scriptName?: string;
}): string[] {
    const args = [
        '-config',
        options.configPath,
        '-n',
        '-log',
        '+stderr',
        options.scriptName ?? ASTYLE_SCRIPT,
        options.sourcePath,
    ];

    if (options.applyChanges) {
        args.push('TRUE');
    }

    return args;
}

/**
 * Run CTL style check or format via worker project + StyleCheck sub-project.
 */
export async function runStyleCheck(options: StyleCheckOptions): Promise<StyleCheckResult> {
    const version = resolveWinCCOAVersion(options.version);
    const projectPath = path.resolve(options.projectPath);
    const sourcePath = path.resolve(options.sourcePath ?? projectPath);
    const applyChanges = options.applyChanges === true;
    const styleCheckPath = path.resolve(
        options.styleCheckProjectPath ?? getDefaultStyleCheckProjectPath(),
    );
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

    const ctrl = new CtrlComponent();
    ctrl.setVersion(version);

    const args = buildCtrlArgs({
        configPath,
        sourcePath,
        applyChanges,
    });

    const exitCode = await ctrl.start(args, { timeout });

    return {
        success: exitCode === 0,
        exitCode,
        stdout: ctrl.stdOut ?? '',
        stderr: ctrl.stdErr ?? '',
        projectPath,
        sourcePath,
        configPath,
        applyChanges,
    };
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

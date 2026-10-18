#!/usr/bin/env node

import { checkStyle, formatStyle } from './style-check';
import { registerWorkerProjectWithStyleCheck } from './register';
import type { StyleCheckOptions } from './types';
import type { ReportFormat } from './reports';

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_FAILED = 2;

export interface ParsedCliArgs {
    command: 'check' | 'format' | 'register';
    projectPath: string;
    sourcePath?: string;
    version?: string;
    langs?: string[];
    styleCheckProjectPath?: string;
    registerProject: boolean;
    timeout?: number;
    blacklist: string[];
    blacklistFile?: string;
    showDiff: boolean;
    reportFormat?: ReportFormat;
    reportFile?: string;
    reportRoot?: string;
}

export function printUsage(): void {
    const bin = 'winccoa-ctrl-style';
    process.stderr.write(
        [
            '',
            'Usage: ' + bin + ' <command> <projectPath> [options]',
            '',
            'Commands:',
            '  check <projectPath>      Dry-run: fail if CTL files need formatting',
            '  format <projectPath>     Format CTL files in place via astyle',
            '  register <projectPath>   Register StyleCheck + worker project only',
            '',
            'Options:',
            '  -v, --version <ver>          WinCC OA version (e.g. 3.21)',
            '  -s, --source <path>          CTL tree to scan (default: projectPath)',
            '  --langs <csv>                Worker project langs (default: en_US.utf8)',
            '  --style-check-path <path>    StyleCheck sub-project (default: package winccoa/StyleCheck)',
            '  --no-register                Skip registration (use existing worker config)',
            '  --blacklist <path>           Skip file/directory (repeatable; relative to CWD)',
            '  --blacklist-file <path>      Path list; entries relative to list file; # comments',
            '  --no-diff                    Disable unified original/formatted diffs',
            '  --report-format <format>     sarif or gitlab (requires --report-file)',
            '  --report-file <path>         Machine-readable output artifact',
            '  --report-root <path>         Checkout root for report paths (default: CWD)',
            '  -t, --timeout <ms>           WCCOActrl timeout in ms (default: 120000)',
            '  -h, --help                   Show this help',
            '',
            'Examples:',
            '  ' + bin + ' register ./src/Squirt -v 3.21',
            '  ' + bin + ' check ./src/Squirt -v 3.21',
            '  ' + bin + ' format ./src/Squirt -v 3.21 -s ./src/Squirt/scripts',
            '',
            'Flow:',
            '  1. Register bundled StyleCheck as non-runnable',
            '  2. Register worker project as runnable with StyleCheck as sub-project',
            '  3. WCCOActrl -config <worker>/config/config -n -log +stderr astyle.ctl ...',
            '',
            '  astyle.config is resolved via getPath (worker, StyleCheck, then OA install).',
            '  Put a custom astyle.config under the worker project config/ if needed.',
            '  Logs and artifacts stay on the worker project, not StyleCheck.',
            '',
            'Local helper script:',
            '  ./scripts/register-stylecheck-projects.sh --project-path ./src/Squirt -v 3.21',
            '',
        ].join('\n'),
    );
}

export function parseArgs(argv: string[]): ParsedCliArgs | null {
    const args = argv.slice(2);

    if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        return null;
    }

    const commandRaw = args[0];
    if (commandRaw !== 'check' && commandRaw !== 'format' && commandRaw !== 'register') {
        process.stderr.write(
            'Error: Unknown command "' +
                commandRaw +
                '". Expected "check", "format", or "register".\n',
        );
        return null;
    }

    const projectPath = args[1];
    if (!projectPath || projectPath.startsWith('-')) {
        process.stderr.write('Error: Missing projectPath.\n');
        return null;
    }

    let version: string | undefined;
    let sourcePath: string | undefined;
    let langs: string[] | undefined;
    let styleCheckProjectPath: string | undefined;
    let registerProject = true;
    let timeout: number | undefined;
    const blacklist: string[] = [];
    let blacklistFile: string | undefined;
    let showDiff = true;
    let reportFormat: ReportFormat | undefined;
    let reportFile: string | undefined;
    let reportRoot: string | undefined;

    let i = 2;
    while (i < args.length) {
        const flag = args[i];
        switch (flag) {
            case '-v':
            case '--version':
                version = args[++i] ?? '';
                break;
            case '-s':
            case '--source':
                sourcePath = args[++i] ?? '';
                break;
            case '--langs': {
                const raw = args[++i] ?? '';
                langs = raw
                    .split(/[ ,]+/)
                    .map((s) => s.trim())
                    .filter(Boolean);
                break;
            }
            case '--style-check-path':
                styleCheckProjectPath = args[++i] ?? '';
                break;
            case '--no-register':
                registerProject = false;
                break;
            case '--blacklist':
            case '--blacklist-file': {
                const value = args[++i];
                if (!value || value.startsWith('-')) {
                    process.stderr.write(`Error: Missing path for ${flag}.\n`);
                    return null;
                }
                if (flag === '--blacklist') blacklist.push(value);
                else blacklistFile = value;
                break;
            }
            case '--no-diff':
                showDiff = false;
                break;
            case '--report-format': {
                const value = args[++i];
                if (value !== 'sarif' && value !== 'gitlab') {
                    process.stderr.write('Error: Report format must be sarif or gitlab.\n');
                    return null;
                }
                reportFormat = value;
                break;
            }
            case '--report-file':
            case '--report-root': {
                const value = args[++i];
                if (!value || value.startsWith('-')) {
                    process.stderr.write(`Error: Missing path for ${flag}.\n`);
                    return null;
                }
                if (flag === '--report-file') reportFile = value;
                else reportRoot = value;
                break;
            }
            case '-t':
            case '--timeout': {
                const raw = args[++i] ?? '';
                const parsed = Number(raw);
                if (Number.isNaN(parsed) || parsed <= 0) {
                    process.stderr.write('Error: Invalid timeout value "' + raw + '".\n');
                    return null;
                }
                timeout = parsed;
                break;
            }
            default:
                process.stderr.write('Error: Unknown option "' + flag + '".\n');
                return null;
        }
        i++;
    }

    if (
        Boolean(reportFormat) !== Boolean(reportFile) ||
        (commandRaw === 'register' && (reportFormat || reportRoot))
    ) {
        process.stderr.write(
            'Error: Reports require check/format and both --report-format and --report-file.\n',
        );
        return null;
    }
    return {
        command: commandRaw,
        projectPath,
        sourcePath: sourcePath || undefined,
        version: version || undefined,
        langs,
        styleCheckProjectPath: styleCheckProjectPath || undefined,
        registerProject,
        timeout,
        blacklist,
        blacklistFile,
        showDiff,
        reportFormat,
        reportFile,
        reportRoot,
    };
}

export async function main(argv: string[] = process.argv): Promise<number> {
    const parsed = parseArgs(argv);

    if (!parsed) {
        printUsage();
        return EXIT_USAGE;
    }

    try {
        if (parsed.command === 'register') {
            process.stderr.write(
                'Registering StyleCheck + worker project ' + parsed.projectPath + '\n',
            );
            const result = await registerWorkerProjectWithStyleCheck({
                projectPath: parsed.projectPath,
                version: parsed.version ?? '',
                langs: parsed.langs,
                styleCheckProjectPath: parsed.styleCheckProjectPath,
                forceRewriteConfig: true,
            });
            process.stderr.write('Registered worker config: ' + result.configPath + '\n');
            process.stderr.write('StyleCheck sub-project: ' + result.styleCheckPath + '\n');
            return EXIT_OK;
        }

        const options: StyleCheckOptions = {
            projectPath: parsed.projectPath,
            version: parsed.version ?? '',
            sourcePath: parsed.sourcePath,
            applyChanges: parsed.command === 'format',
            langs: parsed.langs,
            styleCheckProjectPath: parsed.styleCheckProjectPath,
            registerProject: parsed.registerProject,
            timeout: parsed.timeout,
            blacklist: parsed.blacklist,
            blacklistFile: parsed.blacklistFile,
            showDiff: parsed.showDiff,
            reportFormat: parsed.reportFormat,
            reportFile: parsed.reportFile,
            reportRoot: parsed.reportRoot,
        };

        process.stderr.write(
            (parsed.command === 'format' ? 'Formatting' : 'Checking') +
                ' CTL style for project ' +
                parsed.projectPath +
                '\n',
        );

        const result =
            parsed.command === 'format' ? await formatStyle(options) : await checkStyle(options);

        if (result.stdout) {
            process.stdout.write(result.stdout);
            if (!result.stdout.endsWith('\n')) {
                process.stdout.write('\n');
            }
        }
        if (result.stderr) {
            process.stderr.write(result.stderr);
            if (!result.stderr.endsWith('\n')) {
                process.stderr.write('\n');
            }
        }

        if (result.diff) process.stdout.write(result.diff);

        if (result.success) {
            process.stderr.write('Style operation completed successfully.\n');
            return EXIT_OK;
        }

        process.stderr.write('Style operation failed with exit code ' + result.exitCode + '.\n');
        return EXIT_FAILED;
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write('Error: ' + message + '\n');
        return EXIT_FAILED;
    }
}

const isDirectRun =
    !!process.argv[1] &&
    (process.argv[1].endsWith('cli.js') ||
        process.argv[1].endsWith('cli.ts') ||
        process.argv[1].endsWith('cli.cjs') ||
        process.argv[1].endsWith('cli.mjs'));

if (isDirectRun) {
    main()
        .then((code) => {
            process.exit(code);
        })
        .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err);
            process.stderr.write('Error: ' + message + '\n');
            process.exit(EXIT_FAILED);
        });
}

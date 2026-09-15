/**
 * Options for CTL style check / format via WCCOActrl + astyle.ctl.
 *
 * Worker project is the runnable source project (e.g. Squirt). StyleCheck is
 * registered as a non-runnable sub-project so scripts resolve from there while
 * logs and artifacts stay on the worker project.
 */
export interface StyleCheckOptions {
    /**
     * Absolute or relative path to the runnable WinCC OA source project
     * (the worker project, e.g. `src/Squirt`).
     */
    projectPath: string;

    /**
     * WinCC OA version (e.g. `3.21`).
     */
    version: string;

    /**
     * Directory to scan for `*.ctl` files.
     * Defaults to `projectPath` when omitted.
     */
    sourcePath?: string;

    /**
     * When true, format files in place. When false (default), dry-run only.
     * @default false
     */
    applyChanges?: boolean;

    /**
     * Languages for runnable project registration.
     * @default ['en_US.utf8']
     */
    langs?: string[];

    /**
     * Path or registered id of the StyleCheck sub-project.
     * Defaults to the `winccoa/StyleCheck` directory shipped with this package.
     */
    styleCheckProjectPath?: string;

    /**
     * When true, register StyleCheck (non-runnable) and the worker project
     * (runnable, with StyleCheck as --sub-project) before running.
     * @default true
     */
    registerProject?: boolean;

    /**
     * Timeout in milliseconds for the WCCOActrl process.
     * @default 120000
     */
    timeout?: number;
}

/**
 * Result of a style check / format run.
 */
export interface StyleCheckResult {
    /** True when exit code is 0. */
    success: boolean;

    /** WCCOActrl / astyle exit code. */
    exitCode: number;

    /** Captured stdout. */
    stdout: string;

    /** Captured stderr (includes WinCC OA throwError log lines). */
    stderr: string;

    /** Absolute worker project path. */
    projectPath: string;

    /** Absolute source path that was checked. */
    sourcePath: string;

    /** Absolute path to the worker project config file used with -config. */
    configPath: string;

    /** Whether formatting was applied. */
    applyChanges: boolean;
}

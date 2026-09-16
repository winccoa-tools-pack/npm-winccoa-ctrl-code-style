import fs from 'node:fs';
import path from 'node:path';

/**
 * Resolve the package root that contains `winccoa/StyleCheck`.
 * Works from source (`src/`) and built layouts (`dist/cjs`, `dist/esm`).
 */
export function getPackageRoot(startDir?: string): string {
    let dir = path.resolve(startDir ?? __dirname);

    for (let i = 0; i < 8; i++) {
        const candidate = path.join(dir, 'winccoa', 'StyleCheck');
        const pkgJson = path.join(dir, 'package.json');
        if (fs.existsSync(candidate) && fs.existsSync(pkgJson)) {
            return dir;
        }
        if (fs.existsSync(candidate)) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }

    // Last resort: two levels up from dist/{cjs|esm} or one from src
    return path.resolve(__dirname, '..', '..');
}

/**
 * Absolute path to the bundled StyleCheck WinCC OA subproject.
 */
export function getDefaultStyleCheckProjectPath(): string {
    return path.join(getPackageRoot(), 'winccoa', 'StyleCheck');
}

/**
 * Absolute path to astyle.ctl inside the StyleCheck project.
 * Used to verify the bundled script exists. WCCOActrl must receive the bare
 * name `astyle.ctl` (relative to scripts/), not this full path.
 */
export function getAstyleScriptPath(projectPath?: string): string {
    const root = projectPath ?? getDefaultStyleCheckProjectPath();
    return path.join(root, 'scripts', 'astyle.ctl');
}

/**
 * True when StyleCheck lives under a transient install (npm prefix /tmp,
 * node_modules). Those paths vanish across Docker runs and must not be written
 * into the worker project config.
 */
export function isTransientStyleCheckPath(styleCheckPath: string): boolean {
    const normalized = path.resolve(styleCheckPath).replace(/\\/g, '/').toLowerCase();
    return (
        normalized.includes('/node_modules/') ||
        normalized.includes('/tmp/') ||
        normalized.includes('/temp/') ||
        /\/tmp\./.test(normalized)
    );
}

/**
 * Default durable StyleCheck location next to the worker checkout so Docker
 * volume mounts keep proj_path valid across containers.
 *
 * Prefer GITHUB_WORKSPACE/.artifacts/StyleCheck when set.
 */
export function getDurableStyleCheckProjectPath(workerProjectPath: string): string {
    const workspace = process.env.GITHUB_WORKSPACE;
    if (workspace && workspace.trim()) {
        return path.resolve(workspace, '.artifacts', 'StyleCheck');
    }
    // worker = .../src/Squirt -> .../src/.artifacts/StyleCheck
    return path.resolve(workerProjectPath, '..', '.artifacts', 'StyleCheck');
}

/**
 * Copy bundled StyleCheck scripts into targetDir (scripts/astyle.ctl only).
 * Returns the absolute target directory.
 */
export function materializeStyleCheckProject(
    targetDir: string,
    sourceDir: string = getDefaultStyleCheckProjectPath(),
): string {
    const src = path.resolve(sourceDir);
    const dest = path.resolve(targetDir);
    const srcScript = getAstyleScriptPath(src);
    if (!fs.existsSync(srcScript)) {
        throw new Error(`Bundled astyle.ctl not found: ${srcScript}`);
    }

    const destScripts = path.join(dest, 'scripts');
    fs.mkdirSync(destScripts, { recursive: true });
    fs.copyFileSync(srcScript, path.join(destScripts, 'astyle.ctl'));
    return dest;
}

/**
 * Resolve StyleCheck path for registration: explicit path, or materialize a
 * durable copy when the package default would be transient.
 */
export function resolveStyleCheckProjectPath(options: {
    workerProjectPath: string;
    styleCheckProjectPath?: string;
}): string {
    if (options.styleCheckProjectPath) {
        const explicit = path.resolve(options.styleCheckProjectPath);
        if (isTransientStyleCheckPath(explicit)) {
            const durable = getDurableStyleCheckProjectPath(options.workerProjectPath);
            return materializeStyleCheckProject(durable, explicit);
        }
        return explicit;
    }

    const bundled = getDefaultStyleCheckProjectPath();
    if (!isTransientStyleCheckPath(bundled)) {
        // Dev checkout / local package: use in place.
        return path.resolve(bundled);
    }

    const durable = getDurableStyleCheckProjectPath(options.workerProjectPath);
    return materializeStyleCheckProject(durable, bundled);
}

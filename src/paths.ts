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

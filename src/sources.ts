import fs from 'node:fs';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';

export function collectSources(
    sourcePath: string,
    blacklist: string[] = [],
    blacklistFile?: string,
): { files: string[]; skipped: string[] } {
    const entries = [...blacklist.map((entry) => path.resolve(entry))];
    if (blacklistFile) {
        const filePath = path.resolve(blacklistFile);
        entries.push(
            ...fs
                .readFileSync(filePath, 'utf8')
                .replace(/^\uFEFF/, '')
                .split(/\r?\n/)
                .map((entry) => entry.trim())
                .filter((entry) => entry && !entry.startsWith('#'))
                .map((entry) => path.resolve(path.dirname(filePath), entry)),
        );
    }

    const files: string[] = [];
    const skipped: string[] = [];
    const walk = (directory: string): void => {
        for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
            const filePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                walk(filePath);
            } else if (entry.isFile() && entry.name.endsWith('.ctl')) {
                const excluded = entries.some((excludedPath) => {
                    const relative = path.relative(excludedPath, filePath);
                    return (
                        relative === '' ||
                        (relative !== '..' &&
                            !relative.startsWith(`..${path.sep}`) &&
                            !path.isAbsolute(relative))
                    );
                });
                (excluded ? skipped : files).push(filePath);
            }
        }
    };
    walk(sourcePath);
    return { files: files.sort(), skipped: skipped.sort() };
}

export function sourceDiff(filePath: string, original: string, formatted: string): string {
    if (original === formatted) return '';
    const name = filePath.replace(/\\/g, '/');
    const endings = (content: string): string => {
        const crlf = (content.match(/\r\n/g) ?? []).length;
        const lf = (content.match(/\n/g) ?? []).length - crlf;
        return `CRLF=${crlf}, LF=${lf}`;
    };
    return (
        `Line endings: original ${endings(original)}; formatted ${endings(formatted)}\n` +
        createTwoFilesPatch(name, name, original, formatted, 'original', 'formatted')
    );
}

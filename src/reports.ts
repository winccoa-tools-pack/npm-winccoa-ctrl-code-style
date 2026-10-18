import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { structuredPatch } from 'diff';

export type ReportFormat = 'sarif' | 'gitlab';
export interface StyleFinding {
    path: string;
    line: number;
    ruleId: string;
    message: string;
    fingerprint: string;
}

export function formattingFindings(
    filePath: string,
    original: string,
    formatted: string,
    root: string,
): StyleFinding[] {
    if (original === formatted) return [];
    const relative = path.relative(path.resolve(root), filePath).replace(/\\/g, '/');
    if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
        throw new Error(`Report source is outside report root: ${filePath}`);
    }
    const patch = structuredPatch(relative, relative, original, formatted, '', '', { context: 0 });
    const lineCount = Math.max(1, original.split('\n').length - (original.endsWith('\n') ? 1 : 0));
    const occurrences = new Map<string, number>();
    return patch.hunks.map((hunk) => {
        const signature = hunk.lines.join('\n');
        const occurrence = occurrences.get(signature) ?? 0;
        occurrences.set(signature, occurrence + 1);
        const ruleId = 'winccoa.astyle.Formatting';
        return {
            path: relative,
            line: Math.min(lineCount, Math.max(1, hunk.oldStart)),
            ruleId,
            message: 'Formatting differs from the configured astyle rules.',
            fingerprint: createHash('sha256')
                .update(JSON.stringify([ruleId, relative, signature, occurrence]))
                .digest('hex'),
        };
    });
}

export function writeReport(
    format: ReportFormat,
    filePath: string,
    findings: StyleFinding[],
): void {
    const report =
        format === 'gitlab'
            ? findings.map((finding) => ({
                  description: finding.message,
                  check_name: finding.ruleId,
                  fingerprint: finding.fingerprint,
                  severity: 'minor',
                  location: { path: finding.path, lines: { begin: finding.line } },
              }))
            : {
                  $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
                  version: '2.1.0',
                  runs: [
                      {
                          tool: {
                              driver: {
                                  name: 'winccoa-ctrl-style',
                                  rules: [
                                      {
                                          id: 'winccoa.astyle.Formatting',
                                          shortDescription: { text: 'CTL formatting' },
                                          defaultConfiguration: { level: 'warning' },
                                      },
                                  ],
                              },
                          },
                          invocations: [{ executionSuccessful: true }],
                          results: findings.map((finding) => ({
                              ruleId: finding.ruleId,
                              level: 'warning',
                              message: { text: finding.message },
                              partialFingerprints: { 'winccoaFormatting/v1': finding.fingerprint },
                              locations: [
                                  {
                                      physicalLocation: {
                                          artifactLocation: {
                                              uri: finding.path
                                                  .split('/')
                                                  .map(encodeURIComponent)
                                                  .join('/'),
                                          },
                                          region: { startLine: finding.line },
                                      },
                                  },
                              ],
                          })),
                      },
                  ],
              };
    fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2) + '\n', 'utf8');
}

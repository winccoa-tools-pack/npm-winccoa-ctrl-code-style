import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CtrlComponent } from '@winccoa-tools-pack/npm-winccoa-core/types/components/implementations/CtrlComponent';
import { checkStyle } from '../../src/style-check';

test('reports never turn execution errors into clean scans', async (context) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'report-error-'));
    let executionCode = 2;
    context.mock.method(CtrlComponent.prototype, 'start', async (args: string[]) => {
        if (args[7] === 'TRUE') return 0;
        return executionCode;
    });
    try {
        fs.mkdirSync(path.join(root, 'config'));
        fs.writeFileSync(path.join(root, 'config/config'), '');
        fs.writeFileSync(path.join(root, 'source.ctl'), 'main() {}\n');
        const reportFile = path.join(root, 'report.json');
        const options = { projectPath: root, version: '3.21', registerProject: false,
            reportFormat: 'gitlab' as const, reportFile, reportRoot: root };
        await assert.rejects(checkStyle(options), /formatter execution failed/);
        assert.equal(fs.existsSync(reportFile), false);
        executionCode = 1;
        await assert.rejects(checkStyle(options), /without confirmed formatting changes/);
        assert.equal(fs.existsSync(reportFile), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
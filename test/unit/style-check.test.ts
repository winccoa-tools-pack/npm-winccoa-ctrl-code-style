import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CtrlComponent } from '@winccoa-tools-pack/npm-winccoa-core/types/components/implementations/CtrlComponent';
import { checkStyle, formatStyle } from '../../src/style-check';

test('check/format: manifests exclude blacklisted files and diffs preserve check sources', async (context) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'style-run-'));
    const manifests: string[] = [];
    let calls = 0;
    context.mock.method(CtrlComponent.prototype, 'start', async (args: string[]) => {
        calls++;
        const manifest = args[8];
        manifests.push(manifest);
        const files: string[] = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        assert.equal(files.length, 1);
        assert.equal(path.basename(files[0]), 'bad.ctl');
        if (args[7] === 'TRUE') {
            fs.writeFileSync(files[0], 'main()\n{\n}\n');
            return 0;
        }
        return 1;
    });
    try {
        fs.mkdirSync(path.join(root, 'config'));
        fs.writeFileSync(path.join(root, 'config/config'), '');
        const sourcePath = path.join(root, 'scripts');
        fs.mkdirSync(sourcePath);
        const original = 'main(){\n}\n';
        const bad = path.join(sourcePath, 'bad.ctl');
        const skip = path.join(sourcePath, 'skip.ctl');
        fs.writeFileSync(bad, original);
        fs.writeFileSync(skip, original);
        const options = { projectPath: root, sourcePath, version: '3.21',
            registerProject: false, blacklist: [skip] };

        const checked = await checkStyle(options);
        assert.equal(checked.success, false);
        assert.equal(checked.exitCode, 1);
        assert.match(checked.diff, /-main\(\)\{/);
        assert.match(checked.diff, /\+main\(\)/);
        assert.match(checked.stdout, /SKIPPED-BLACKLIST/);
        assert.deepEqual(checked.skippedFiles, [skip]);
        assert.equal(fs.readFileSync(bad, 'utf8'), original);
        assert.equal(fs.readFileSync(skip, 'utf8'), original);
        assert.equal(calls, 2);
        assert.ok(manifests.every((manifest) => !fs.existsSync(manifest)));

        const reportFile = path.join(root, 'report.sarif');
        const reported = await checkStyle({ ...options, showDiff: false,
            reportFormat: 'sarif', reportFile, reportRoot: root });
        assert.equal(reported.diff, '');
        assert.equal(reported.findings[0].path, 'scripts/bad.ctl');
        assert.equal(JSON.parse(fs.readFileSync(reportFile, 'utf8')).runs[0].results.length, 1);
        assert.equal(calls, 4);

        const withoutDiff = await checkStyle({ ...options, showDiff: false });
        assert.equal(withoutDiff.diff, '');
        assert.equal(calls, 5);

        const formatted = await formatStyle(options);
        assert.equal(formatted.success, true);
        assert.match(formatted.diff, /-main\(\)\{/);
        assert.equal(fs.readFileSync(bad, 'utf8'), 'main()\n{\n}\n');
        assert.equal(fs.readFileSync(skip, 'utf8'), original);
        assert.equal(calls, 6);

        const emptyReport = await checkStyle({ ...options, blacklist: [sourcePath],
            reportFormat: 'gitlab', reportFile, reportRoot: root });
        assert.equal(emptyReport.success, true);
        assert.deepEqual(JSON.parse(fs.readFileSync(reportFile, 'utf8')), []);

        const excluded = await checkStyle({ ...options, blacklist: [sourcePath] });
        assert.equal(excluded.success, true);
        assert.equal(excluded.diff, '');
        assert.equal(excluded.skippedFiles.length, 2);
        assert.equal(calls, 6);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('check: temporary files are removed when the manager throws', async (context) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'style-error-'));
    let manifest = '';
    context.mock.method(CtrlComponent.prototype, 'start', async (args: string[]) => {
        manifest = args[8];
        throw new Error('manager unavailable');
    });
    try {
        fs.mkdirSync(path.join(root, 'config'));
        fs.writeFileSync(path.join(root, 'config/config'), '');
        fs.writeFileSync(path.join(root, 'bad.ctl'), 'main(){}');
        const reportFile = path.join(root, 'stale.json');
        fs.writeFileSync(reportFile, '[]');
        await assert.rejects(checkStyle({ projectPath: root, version: '3.21',
            registerProject: false, reportFormat: 'gitlab', reportFile }), /manager unavailable/);
        assert.equal(fs.existsSync(reportFile), false);
        assert.ok(manifest);
        assert.equal(fs.existsSync(path.dirname(manifest)), false);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
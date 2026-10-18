import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkStyle, formatStyle } from '../../src/style-check';

test('native WinCC OA: blacklist, check diff and in-place format', {
    skip: !process.env.WINCCOA_STYLE_TEST_PROJECT,
}, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-style-'));
    try {
        const original = 'main(){int number=1;if(number){number++;}}\n';
        const source = path.join(root, 'needs formatting.ctl');
        const excluded = path.join(root, 'excluded.ctl');
        fs.writeFileSync(source, original);
        fs.writeFileSync(excluded, original);
        const options = {
            projectPath: process.env.WINCCOA_STYLE_TEST_PROJECT!,
            version: process.env.WINCCOA_STYLE_TEST_VERSION ?? '3.21',
            sourcePath: root,
            registerProject: false,
            blacklist: [excluded],
        };
        const reportFile = path.join(root, 'style.sarif');
        const checked = await checkStyle({ ...options, reportFormat: 'sarif', reportFile, reportRoot: root });
        assert.equal(checked.success, false, checked.stderr);
        assert.match(checked.diff, /--- .*needs formatting.ctl/, checked.stdout + checked.stderr);
        assert.match(checked.diff, /\+\+\+ .*needs formatting.ctl/);
        assert.equal(fs.readFileSync(source, 'utf8'), original);
        assert.deepEqual(checked.skippedFiles, [excluded]);
        assert.ok(JSON.parse(fs.readFileSync(reportFile, 'utf8')).runs[0].results.length > 0);
        assert.equal(checked.findings[0].path, 'needs formatting.ctl');

        const formatted = await formatStyle(options);
        assert.equal(formatted.success, true, formatted.stderr);
        assert.notEqual(formatted.diff, '');
        assert.equal(fs.readFileSync(excluded, 'utf8'), original);
        const clean = await checkStyle({ ...options, reportFormat: 'gitlab', reportFile, reportRoot: root, showDiff: false });
        assert.equal(clean.success, true, clean.stderr);
        assert.equal(clean.diff, '');
        assert.deepEqual(JSON.parse(fs.readFileSync(reportFile, 'utf8')), []);

        const allExcluded = await checkStyle({ ...options, blacklist: [root] });
        assert.equal(allExcluded.success, true);
        assert.equal(allExcluded.skippedFiles.length, 2);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
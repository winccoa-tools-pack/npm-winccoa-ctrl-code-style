import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { parseArgs } from '../../src/cli';
import { buildCtrlArgs } from '../../src/style-check';
import {
    getAstyleScriptPath,
    getDefaultStyleCheckProjectPath,
    getPackageRoot,
} from '../../src/paths';

test('parseArgs: returns null for --help', () => {
    const parsed = parseArgs(['node', 'cli.ts', '--help']);
    assert.equal(parsed, null);
});

test('parseArgs: parses check with version and source', () => {
    const parsed = parseArgs([
        'node',
        'cli.ts',
        'check',
        './src/Squirt',
        '--version',
        '3.21',
        '--source',
        './src/Squirt/scripts',
        '--timeout',
        '90000',
    ]);

    assert.ok(parsed);
    assert.equal(parsed.command, 'check');
    assert.equal(parsed.projectPath, './src/Squirt');
    assert.equal(parsed.version, '3.21');
    assert.equal(parsed.sourcePath, './src/Squirt/scripts');
    assert.equal(parsed.timeout, 90000);
    assert.equal(parsed.registerProject, true);
});

test('parseArgs: format and --no-register', () => {
    const parsed = parseArgs([
        'node',
        'cli.ts',
        'format',
        'C:/code/Squirt',
        '-v',
        '3.21',
        '--no-register',
    ]);

    assert.ok(parsed);
    assert.equal(parsed.command, 'format');
    assert.equal(parsed.registerProject, false);
});

test('parseArgs: register command', () => {
    const parsed = parseArgs([
        'node',
        'cli.ts',
        'register',
        './src/Squirt',
        '-v',
        '3.21',
        '--langs',
        'en_US.utf8,de_AT.utf8',
    ]);
    assert.ok(parsed);
    assert.equal(parsed.command, 'register');
    assert.deepEqual(parsed.langs, ['en_US.utf8', 'de_AT.utf8']);
});

test('parseArgs: rejects unknown command', () => {
    const originalWrite = process.stderr.write.bind(process.stderr);
    (process.stderr.write as unknown as (c: string) => boolean) = () => true;
    try {
        const parsed = parseArgs(['node', 'cli.ts', 'convert', './x']);
        assert.equal(parsed, null);
    } finally {
        process.stderr.write = originalWrite;
    }
});

test('buildCtrlArgs: dry-run uses -config', () => {
    const args = buildCtrlArgs({
        configPath: '/repo/src/Squirt/config/config',
        sourcePath: '/repo/src/Squirt',
        applyChanges: false,
    });
    assert.deepEqual(args, [
        '-config',
        '/repo/src/Squirt/config/config',
        '-n',
        '-log',
        '+stderr',
        'astyle.ctl',
        '/repo/src/Squirt',
    ]);
});

test('buildCtrlArgs: applyChanges true appends TRUE', () => {
    const args = buildCtrlArgs({
        configPath: '/cfg',
        sourcePath: '/src',
        applyChanges: true,
    });
    assert.ok(args.includes('TRUE'));
    assert.equal(args[args.length - 1], 'TRUE');
    assert.ok(args.includes('-config'));
    assert.equal(args[5], 'astyle.ctl');
});

test('paths: package root resolves StyleCheck and astyle.ctl', () => {
    const root = getPackageRoot();
    const project = getDefaultStyleCheckProjectPath();
    const script = getAstyleScriptPath();
    assert.ok(fs.existsSync(project), project);
    assert.ok(fs.existsSync(script), script);
    assert.equal(path.basename(project), 'StyleCheck');
    assert.equal(path.basename(script), 'astyle.ctl');
    assert.ok(root.length > 0);
});

test('helper scripts exist', () => {
    const sh = path.join(getPackageRoot(), 'scripts', 'register-stylecheck-projects.sh');
    const ps1 = path.join(getPackageRoot(), 'scripts', 'register-stylecheck-projects.ps1');
    assert.ok(fs.existsSync(sh), sh);
    assert.ok(fs.existsSync(ps1), ps1);
});
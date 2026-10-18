import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collectSources, sourceDiff } from '../../src/sources';

test('blacklist selects exact files and directory descendants, not sibling prefixes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'style-sources-'));
    try {
        fs.mkdirSync(path.join(root, 'vendor'));
        fs.mkdirSync(path.join(root, 'vendor-extra'));
        for (const name of ['skip.ctl', 'keep.ctl', 'vendor/a.ctl', 'vendor-extra/a.ctl']) {
            fs.writeFileSync(path.join(root, name), 'void main() {}\n');
        }
        fs.writeFileSync(path.join(root, 'not-a-script.txt'), '');
        const result = collectSources(root, [path.join(root, 'skip.ctl'), path.join(root, 'vendor')]);
        assert.deepEqual(result.files, ['keep.ctl', 'vendor-extra/a.ctl'].map((name) => path.join(root, name)));
        assert.equal(result.skipped.length, 2);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('blacklist file accepts BOM, comments, CRLF and paths relative to its own directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'style-blacklist-'));
    try {
        fs.writeFileSync(path.join(root, 'space name.ctl'), '');
        fs.writeFileSync(path.join(root, 'keep.ctl'), '');
        const blacklist = path.join(root, '.style-blacklist');
        fs.writeFileSync(blacklist, '\uFEFF# reason\r\n\r\nspace name.ctl\r\n');
        assert.deepEqual(collectSources(root, [], blacklist), {
            files: [path.join(root, 'keep.ctl')],
            skipped: [path.join(root, 'space name.ctl')],
        });
        assert.equal(collectSources(root, [root]).files.length, 0);
        assert.throws(() => collectSources(root, [], path.join(root, 'missing')));
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('unified diff includes original/formatted content and exposes line ending changes', () => {
    const patch = sourceDiff('scripts/test.ctl', 'main(){\n}\n', 'main()\n{\n}\n');
    assert.match(patch, /--- scripts\/test.ctl\toriginal/);
    assert.match(patch, /\+\+\+ scripts\/test.ctl\tformatted/);
    assert.match(patch, /-main\(\)\{/);
    assert.match(patch, /\+main\(\)/);
    assert.match(sourceDiff('test.ctl', 'main()\r\n', 'main()\n'),
        /original CRLF=1, LF=0; formatted CRLF=0, LF=1/);
    assert.equal(sourceDiff('test.ctl', 'same\n', 'same\n'), '');
});
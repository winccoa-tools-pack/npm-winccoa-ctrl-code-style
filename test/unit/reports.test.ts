import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { formattingFindings, writeReport } from '../../src/reports';

test('reports use original source locations, stable fingerprints and portable paths', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'style-reports-'));
    try {
        const source = path.join(root, 'scripts', 'space name.ctl');
        const findings = formattingFindings(source, 'main(){\n}\n', 'main()\n{\n}\n', root);
        assert.equal(findings[0].path, 'scripts/space name.ctl');
        assert.equal(findings[0].line, 1);
        assert.deepEqual(formattingFindings(source, 'main(){\n}\n', 'main()\n{\n}\n', root), findings);
        assert.throws(() => formattingFindings(path.join(root, '..', 'outside.ctl'), 'a', 'b', root));
        const sarifPath = path.join(root, 'output', 'style.sarif');
        writeReport('sarif', sarifPath, findings);
        const sarif = JSON.parse(fs.readFileSync(sarifPath, 'utf8'));
        assert.equal(sarif.version, '2.1.0');
        assert.equal(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'scripts/space%20name.ctl');
        const gitlabPath = path.join(root, 'gitlab.json');
        writeReport('gitlab', gitlabPath, findings);
        const gitlab = JSON.parse(fs.readFileSync(gitlabPath, 'utf8'));
        assert.equal(gitlab[0].location.lines.begin, 1);
        assert.equal(gitlab[0].fingerprint, findings[0].fingerprint);
        writeReport('gitlab', gitlabPath, []);
        assert.deepEqual(JSON.parse(fs.readFileSync(gitlabPath, 'utf8')), []);
        assert.deepEqual(formattingFindings(source, 'same', 'same', root), []);
        const shifted = formattingFindings(source, '// header\nmain(){\n}\n', '// header\nmain()\n{\n}\n', root);
        assert.equal(shifted[0].fingerprint, findings[0].fingerprint);
        assert.equal(shifted[0].line, 2);
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});
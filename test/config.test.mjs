/**
 * **The one setting, and the two ways it is allowed to fail.** It refuses by name, the file and the key and
 * what was expected, because a setting silently ignored is a setting someone believes is in force. A missing
 * file is not a failure: it is the shipped default.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULTS, configPath, loadConfig, normalise } from '../src/config.mjs';

const TEMPS = [];
after(() => {
	for (const dir of TEMPS) rmSync(dir, { recursive: true, force: true });
});

function agentDirWith(json) {
	const dir = mkdtempSync(join(tmpdir(), 'pi-footer-hint-'));
	TEMPS.push(dir);
	if (json !== undefined) writeFileSync(join(dir, 'pi-footer-hint.json'), typeof json === 'string' ? json : JSON.stringify(json));
	return dir;
}

test('no file means the shipped defaults', () => {
	assert.deepEqual(loadConfig({ agentDir: agentDirWith(), env: {} }), DEFAULTS);
	assert.deepEqual(DEFAULTS, { chars: 80 });
});

test('a file changes the length', () => {
	assert.equal(loadConfig({ agentDir: agentDirWith({ chars: 40 }), env: {} }).chars, 40);
});

test('an unknown setting is refused with the file and the key', () => {
	const dir = agentDirWith({ length: 40 });
	assert.throws(
		() => loadConfig({ agentDir: dir, env: {} }),
		(error) =>
			new RegExp(`${dir}/pi-footer-hint\\.json`).test(error.message) &&
			/unknown setting "length"/.test(error.message) &&
			/the only setting is chars/.test(error.message)
	);
});

test('a length outside the range is refused with the value and the range', () => {
	assert.throws(() => normalise({ chars: '60' }), /"chars" must be a whole number from 10 to 200, not "60"/);
	assert.throws(() => normalise({ chars: 9 }), /from 10 to 200/);
	assert.throws(() => normalise({ chars: 201 }), /from 10 to 200/);
	assert.throws(() => normalise({ chars: 60.5 }), /whole number/);
	assert.throws(() => normalise([]), /the config must be a JSON object/);
	assert.doesNotThrow(() => normalise({ chars: 10 }));
	assert.doesNotThrow(() => normalise({ chars: 200 }));
});

test('a file that is not JSON names itself', () => {
	const dir = agentDirWith('{ chars: 40, }');
	assert.throws(() => loadConfig({ agentDir: dir, env: {} }), /is not valid JSON/);
});

test('$PI_FOOTER_HINT_CONFIG replaces the path, and a missing path is still not an error', () => {
	const dir = agentDirWith({ chars: 30 });
	const elsewhere = join(dir, 'custom.json');
	writeFileSync(elsewhere, JSON.stringify({ chars: 70 }));

	assert.equal(configPath({ agentDir: dir, env: { PI_FOOTER_HINT_CONFIG: elsewhere } }), elsewhere);
	assert.equal(loadConfig({ agentDir: dir, env: { PI_FOOTER_HINT_CONFIG: elsewhere } }).chars, 70);
	assert.deepEqual(loadConfig({ agentDir: dir, env: { PI_FOOTER_HINT_CONFIG: join(dir, 'nope.json') } }), DEFAULTS);
});

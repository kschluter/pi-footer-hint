/**
 * **The extension, wired to a stub of Pi.** What is asserted here is who gets to name a session and when: the
 * opener of a resumed session, the first input of a new one, never a session that already has a name, and nothing
 * after the opening message.
 */
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const TEMPS = [];
after(() => {
	for (const dir of TEMPS) rmSync(dir, { recursive: true, force: true });
});

const userEntry = (text) => ({ type: 'message', message: { role: 'user', content: text } });
const assistantEntry = (text) => ({ type: 'message', message: { role: 'assistant', content: [{ type: 'text', text }] } });

/**
 * Load the extension with a stub Pi: a branch the test can extend, and a session name that records every write.
 * The module import is cached, but the factory re-reads its config on every call, which is what the per-test
 * config files rely on.
 */
async function load({ config, branch = [], name } = {}) {
	const dir = mkdtempSync(join(tmpdir(), 'pi-footer-hint-ext-'));
	TEMPS.push(dir);
	const configPath = join(dir, 'pi-footer-hint.json');
	if (config) writeFileSync(configPath, JSON.stringify(config));
	process.env.PI_FOOTER_HINT_CONFIG = configPath;

	const mod = await import('../src/index.ts');
	const hooks = new Map();
	const facts = { branch: [...branch], name };
	const writes = [];

	mod.default({
		on: (event, handler) => hooks.set(event, handler),
		getSessionName: () => facts.name,
		setSessionName: (value) => {
			facts.name = value;
			writes.push(value);
		}
	});

	const ctx = {
		mode: 'tui',
		sessionManager: { getBranch: () => facts.branch, getSessionName: () => facts.name }
	};

	const fire = async (event, payload = {}) => {
		const handler = hooks.get(event);
		assert.ok(handler, `no handler for ${event}`);
		return handler({ type: event, ...payload }, ctx);
	};

	/** Typed input, the way Pi delivers it: announced before it becomes an entry. */
	const type = async (text, source = 'user') => {
		await fire('input', { text, source });
		facts.branch.push(userEntry(text));
	};

	return { hooks, facts, writes, ctx, fire, type, name: () => facts.name };
}

test('a Pi without the naming API loads and stays quiet', async () => {
	const mod = await import('../src/index.ts');
	const hooks = new Map();
	assert.doesNotThrow(() => mod.default({ on: (event, handler) => hooks.set(event, handler) }));
	assert.equal(hooks.size, 0, 'no handlers registered, so nothing can throw later');
});

test('a new session is named from its first input, and not before', async () => {
	const { fire, type, writes, name } = await load();
	await fire('session_start', { reason: 'startup' });
	assert.equal(name(), undefined, 'a new session arrives empty, so there is nothing to read yet');

	await type('add a footer hint extension');
	assert.equal(name(), 'add a footer hint extension');
	assert.equal(writes.length, 1);
});

test('a resumed session is named at startup from its opener', async () => {
	const { fire, name } = await load({ branch: [userEntry('fix the auth bug'), assistantEntry('done')] });
	await fire('session_start', { reason: 'resume' });
	assert.equal(name(), 'fix the auth bug', 'read from the branch, before anything is typed');
});

test('a session that already has a name is left alone', async () => {
	const { fire, type, writes, name } = await load({ name: 'my own name', branch: [userEntry('the opener')] });
	await fire('session_start', { reason: 'resume' });
	await type('a later message');
	assert.equal(name(), 'my own name');
	assert.deepEqual(writes, [], '/name always wins');
});

test('only the first input names the session', async () => {
	const { type, writes, name } = await load();
	await type('the first thing i typed');
	await type('a second message');
	await type('and a third');
	assert.equal(name(), 'the first thing i typed');
	assert.equal(writes.length, 1, 'no rewrite on later messages');
});

test('a name removed by something else is not put back', async () => {
	const { facts, type, name } = await load();
	await type('the first thing i typed');
	facts.name = undefined; // another extension, or a session edited by hand
	await type('a later message');
	assert.equal(name(), undefined, 'only a first input names a session, so nothing is renamed later');
});

test('input from another extension is not a name', async () => {
	const { type, writes, name } = await load();
	await type('injected by an extension', 'extension');
	assert.equal(name(), undefined);
	assert.deepEqual(writes, []);
});

test('an injected wrapper is not a name, and the next real input is', async () => {
	const { type, name } = await load();
	await type('<environment>cwd=/tmp</environment>');
	assert.equal(name(), undefined, 'context in angle brackets describes nothing');
	assert.equal(name() !== '<environment>cwd=/tmp</environment>', true);
});

test('the configured length is what the name becomes', async () => {
	const { type, name } = await load({ config: { chars: 20 } });
	await type('a message long enough that it cannot possibly fit in twenty characters');
	assert.equal(name(), 'a message long enou…');
});

test('a name is written once per session even if both events fire', async () => {
	const { fire, type, writes } = await load();
	await fire('session_start', { reason: 'new' });
	await type('the opener');
	await fire('session_start', { reason: 'reload' });
	assert.equal(writes.length, 1, 'the second startup sees a name and returns');
});

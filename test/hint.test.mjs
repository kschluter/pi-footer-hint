/**
 * **The name's text, on its own.** Everything here is a pure function of Pi's session entries or a typed input,
 * so the awkward cases get asserted directly: an image-only opener, an injected wrapper, a message that lands on
 * an emoji in the middle of a character.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { condense, firstPrompt, hasUserTurn, isInjected, promptText } from '../src/hint.mjs';

const user = (content) => ({ type: 'message', message: { role: 'user', content } });

test('a plain string prompt is used as it is', () => {
	assert.equal(promptText('fix the auth bug'), 'fix the auth bug');
});

test('a prompt in blocks keeps its text and drops its images', () => {
	const content = [
		{ type: 'text', text: 'what is wrong with this' },
		{ type: 'image', data: 'AAAA' },
		{ type: 'text', text: 'screenshot attached' }
	];
	assert.equal(promptText(content), 'what is wrong with this screenshot attached');
});

test('a multi-line prompt becomes one line, because the name is drawn on one row', () => {
	assert.equal(promptText('Fix this test.\n\n```\n  expected 1\n\tgot 2\n```\n'), 'Fix this test. ``` expected 1 got 2 ```');
});

test('everything before the first user message is skipped', () => {
	const entries = [
		{ type: 'message', message: { role: 'system', content: 'you are a coding agent' } },
		{ type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] } },
		{ type: 'compaction', summary: 'we discussed the footer' },
		user('the first thing i typed')
	];
	assert.equal(firstPrompt(entries), 'the first thing i typed');
});

test('an injected wrapper is not a name, and the next real message is used', () => {
	const entries = [user('<environment>cwd=/tmp</environment>'), user('this one is mine')];
	assert.equal(firstPrompt(entries), 'this one is mine');
	assert.equal(isInjected('<environment>cwd=/tmp</environment>'), true);
	assert.equal(isInjected('  <context>'), true, 'leading whitespace does not hide it');
	assert.equal(isInjected('a < b'), false, 'an angle bracket mid-sentence is just text');
});

test('an image-only opener is skipped in favour of one with words', () => {
	assert.equal(firstPrompt([user([{ type: 'image', data: 'AAAA' }]), user('this one has text')]), 'this one has text');
});

test('a session with no real prompt yet has no name', () => {
	assert.equal(firstPrompt([]), null);
	assert.equal(firstPrompt(undefined), null);
	assert.equal(firstPrompt([user('   \n\t  ')]), null, 'whitespace is not a prompt');
	assert.equal(firstPrompt([user('<injected>')]), null, 'and neither is context');
});

test('a user turn is what tells a new session from one already spoken in', () => {
	assert.equal(hasUserTurn([]), false);
	assert.equal(hasUserTurn([{ type: 'message', message: { role: 'assistant', content: 'hi' } }]), false);
	assert.equal(hasUserTurn([user('anything')]), true, 'even an injected or image turn counts as spoken');
});

test('a name that fits is untouched', () => {
	assert.equal(condense('fix the auth bug', 80), 'fix the auth bug');
	assert.equal(condense('0123456789', 10), '0123456789', 'the boundary is inclusive');
});

test('a long name fits the budget, ellipsis included', () => {
	const line = condense('a'.repeat(200), 80);
	assert.equal([...line].length, 80, 'the ellipsis is paid for out of the budget, not added to it');
	assert.equal(line.slice(0, 79), 'a'.repeat(79));
});

test('a cut never lands in the middle of a character', () => {
	const line = condense('🙂'.repeat(20), 3);
	assert.equal([...line].length, 3, 'two characters and the ellipsis');
	assert.doesNotMatch(line, /\uFFFD|[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
});

test('a cut does not leave a trailing space before the ellipsis', () => {
	assert.equal(condense('the quick brown fox', 9), 'the quic…', 'eight characters and the ellipsis');
});

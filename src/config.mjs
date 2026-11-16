/**
 * **One setting, and it refuses by name.**
 *
 * The extension has exactly one decision a user could disagree with: how much of the first message becomes the
 * name. 80 is the default because that is what fits before Pi's footer starts truncating a path line.
 * Anything else in the file is a typo, and a typo that is ignored is a setting someone believes is in force,
 * so an unknown key or an out-of-range value throws with the file, the key and what was expected.
 *
 * The file is `<agentDir>/pi-footer-hint.json`, and `$PI_FOOTER_HINT_CONFIG` replaces the whole path, which
 * is what a deployment that redirects `PI_CODING_AGENT_DIR` needs and what lets the suite test this without
 * touching a real config. A missing file is not an error: no file means the shipped default.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** What a session does when there is no config file. */
export const DEFAULTS = {
	/** Characters of the first message to use as the name. */
	chars: 80
};

const fail = (source, message) => {
	throw new Error(`pi-footer-hint: ${message}${source ? ` (${source})` : ''}`);
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Validate an override and merge it over `DEFAULTS`. Exported so the rules can be tested without a file on
 * disk, and so the message a user sees is the message the test asserts.
 *
 * @param {unknown} patch
 * @param {string} [source] the path or label to name in an error
 * @returns {typeof DEFAULTS}
 */
export function normalise(patch, source = '') {
	if (patch === undefined || patch === null) return { ...DEFAULTS };
	if (!isPlainObject(patch)) fail(source, 'the config must be a JSON object');

	const config = { ...DEFAULTS };

	for (const [key, value] of Object.entries(patch)) {
		switch (key) {
			case 'chars':
				if (!Number.isInteger(value) || value < 10 || value > 200) {
					fail(source, `"chars" must be a whole number from 10 to 200, not ${JSON.stringify(value)}`);
				}
				config.chars = value;
				break;
			default:
				fail(source, `unknown setting ${JSON.stringify(key)}; the only setting is chars`);
		}
	}

	return config;
}

/**
 * The config path this session reads.
 * @param {{agentDir: string, env?: NodeJS.ProcessEnv}} options
 */
export function configPath({ agentDir, env = process.env }) {
	return env.PI_FOOTER_HINT_CONFIG || join(agentDir, 'pi-footer-hint.json');
}

/**
 * Read the session's config. A missing file is the shipped default. A file that cannot be parsed, or that
 * says something this package cannot do, stops the extension from loading and says why, because a footer
 * line governed by a setting nobody's install is honouring is worse than a footer line that is absent.
 *
 * @param {{agentDir: string, env?: NodeJS.ProcessEnv}} options
 * @returns {typeof DEFAULTS}
 */
export function loadConfig({ agentDir, env = process.env }) {
	const path = configPath({ agentDir, env });
	let raw;
	try {
		raw = readFileSync(path, 'utf8');
	} catch (error) {
		if (error.code === 'ENOENT') return { ...DEFAULTS };
		fail(path, `cannot be read: ${error.message}`);
	}

	let parsed;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		fail(path, `is not valid JSON: ${error.message}`);
	}
	return normalise(parsed, path);
}

/**
 * **The text of the hint: the first thing you said in this session, condensed to a name.**
 *
 * Pi renders a session name in the footer as `<cwd> • <name>` and in the session selector. An unnamed session
 * shows nothing in either place, which is what this package fills: the opener of the conversation, short enough
 * to read at the end of a path.
 *
 * Everything here is pure: entries or an input string in, one line out. Nothing decides *when* to name a
 * session; that is `src/index.ts`.
 */

/**
 * One line from a message's content. A user message is a string or a list of blocks, and blocks can hold images
 * with no text at all. Whitespace collapses because the name is drawn on a row of its own.
 *
 * @param {string | Array<{type: string, text?: string}> | undefined} content
 * @returns {string}
 */
export function promptText(content) {
	const flat = typeof content === 'string'
		? content
		: Array.isArray(content)
			? content.filter((block) => block?.type === 'text' && typeof block.text === 'string').map((block) => block.text).join(' ')
			: '';
	return oneLine(flat);
}

function oneLine(text) {
	return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Text that was not typed by a person. Pi and some extensions wrap injected context in angle brackets, and a
 * session named `<environment>…` describes nothing, so those are refused rather than shortened.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isInjected(text) {
	return oneLine(text).startsWith('<');
}

/**
 * The first prompt in the session, or `null`.
 *
 * Only user messages count. A message with no words, which is how an image-only turn looks, and a message that
 * is injected context are both passed over in favour of the next one that is real typing.
 *
 * @param {Array<{type?: string, message?: {role?: string, content?: unknown}}>} entries
 * @returns {string|null}
 */
export function firstPrompt(entries) {
	for (const entry of entries ?? []) {
		if (entry?.type !== 'message') continue;
		const message = entry.message;
		if (!message || message.role !== 'user') continue;
		const text = promptText(message.content);
		if (!text || isInjected(text)) continue;
		return text;
	}
	return null;
}

/**
 * Whether the conversation holds a user turn, which is what tells a new session from one that has already been
 * spoken in. Used to stop a deliberate `/name` clear from being undone on the next message.
 *
 * @param {Array<{type?: string, message?: {role?: string}}>} entries
 * @returns {boolean}
 */
export function hasUserTurn(entries) {
	return (entries ?? []).some((entry) => entry?.type === 'message' && entry.message?.role === 'user');
}

/**
 * The name: one line, at most `chars` characters, with an ellipsis when anything was cut.
 *
 * The ellipsis is paid for out of the budget rather than added to it, so the result is never longer than `chars`.
 * The count is in code points rather than bytes or UTF-16 units, so a cut that lands on an emoji does not leave
 * half a character in the footer.
 *
 * @param {string|null|undefined} text
 * @param {number} chars
 * @returns {string}
 */
export function condense(text, chars) {
	const line = oneLine(text);
	if (!line) return '';
	const points = [...line];
	if (points.length <= chars) return line;
	return `${points.slice(0, Math.max(0, chars - 1)).join('').trimEnd()}…`;
}

/**
 * **`pi-footer-hint`: name an unnamed session from the first thing you said.**
 *
 * Pi draws a session name at the right end of the footer's path line, as `<cwd> • <name>`, and lists it in the
 * session selector. An unnamed session shows nothing in either place, so a long session is only a timestamp in
 * `/resume`. This names it from the opener of the conversation.
 *
 * Three rules, and the second and third are what keep it from fighting you:
 *
 * - **The name is written once.** `pi.getSessionName()` is checked first, so a name you set with `/name` is
 *   never overwritten, and a session named on an earlier day is not renamed on resume.
 * - **A new session is named on its first input, not at `session_start`.** A new session arrives empty, so
 *   there is no opener to read yet; the `input` event carries the text before it becomes an entry.
 *   Resumed, forked and reloaded sessions do hold their opener, so `session_start` names those.
 * - **Nothing renames a session after its first turn.** One flag decides it, so a name is never overwritten by a
 *   later message. Pi has no command that clears a name; the flag keeps the promise should one appear.
 * - **The session is read once.** `getBranch()` copies the whole path and `getEntries()` copies the whole session,
 *   so both are called at `session_start` and never from the input handler, which runs on every message.
 *
 * It never touches the footer. Pi renders the name itself, so every line of the footer stays Pi's, and nothing
 * here redraws anything or reads what other extensions put there.
 *
 * The text rules are in `src/hint.mjs` and the one setting in `src/config.mjs`.
 */
import type { ExtensionAPI, SessionEntry } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";

import { condense, firstPrompt, hasUserTurn, isInjected } from "./hint.mjs";
import { loadConfig } from "./config.mjs";

export default function footerHint(pi: ExtensionAPI) {
	// The naming API is the whole package. A Pi that lacks it loads this extension and gets silence, rather than an
	// exception thrown from an event handler on every message.
	if (typeof pi.setSessionName !== "function" || typeof pi.getSessionName !== "function") return;

	// Resolved once, at load: a config file that says something this package cannot do fails here, loudly.
	const config = loadConfig({
		agentDir: process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent")
	});

	/**
	 * The branch as it stood when the session opened, and whether it was already spoken in.
	 *
	 * Both are read once. `getBranch()` copies the whole path from the leaf to the root, and `getEntries()` copies
	 * the whole session, so calling either from the input handler would rebuild an array on every message the user
	 * ever sends, forever, to answer a question whose answer cannot change after the first turn.
	 */
	let opened: SessionEntry[] = [];
	let spoken = false;

	/**
	 * Name the session once: from the branch when it already holds the opener, otherwise from `fallback`, the
	 * input that is about to become it.
	 */
	const name = (fallback?: string) => {
		if (pi.getSessionName()) return;

		// The session's own opener, which is what a resumed, forked or reloaded session has.
		const existing = firstPrompt(opened);
		if (existing) {
			pi.setSessionName(condense(existing, config.chars));
			return;
		}

		if (fallback === undefined) return;
		const text = condense(fallback, config.chars);
		if (!text || isInjected(text)) return;
		pi.setSessionName(text);
	};

	// Resumed, forked and reloaded sessions already hold their opening message. This is the only place the branch
	// is read.
	pi.on("session_start", (_event, ctx) => {
		opened = ctx.sessionManager.getBranch();
		spoken = hasUserTurn(opened);
		name();
	});

	// A new session is still empty at `session_start`, so it is named here, on its first real input.
	pi.on("input", (event) => {
		if (event.source === "extension") return;
		// A name, or a session that was already spoken in, needs nothing from this event, and neither needs a walk
		// through the session to find that out.
		if (!pi.getSessionName() && !spoken) name(event.text);
		spoken = true;
	});
}

# AGENTS.md: pi-footer-hint

Rules for this repository. The package ships through npm, so anyone can read the tarball without seeing this file.

What it is: a Pi extension that names an unnamed session from the opening of the conversation. It calls
`pi.setSessionName()` with the first user message condensed to `chars`, and Pi draws that name at the end of the
footer path line and lists it in `/resume`.

What it must never become:

- **A renderer.** It draws nothing. `ctx.ui.setFooter()` and `ctx.ui.setStatus()` are out of scope: Pi owns every
  footer line, and supplying a name is the whole job.
- **A summariser.** No model call, no classifier. The name is the opener, whitespace collapsed and cut.
- **A daemon.** No timer, no watcher, no state on disk beyond the name Pi persists. Two handlers, both returning
  before the turn starts.
- **A record of the author's machine.** See below.

## Invariants

1. **Host packages are peers, never dependencies, and the range is `"*"`.** A copy in `dependencies` bypasses Pi's
   extension module mapping and duplicates registries. The range is `"*"` because that is Pi's own guidance for host
   packages: a tighter range becomes a peer conflict for anyone on a different Pi, which is a worse failure than an
   extension that guards what it calls. There is no `engines` field either, because this code does not run under
   `node` at all; Pi supplies the runtime.
2. **A name that exists is never overwritten.** `pi.getSessionName()` is the first check, before any reading.
3. **A name is written once.** Only a first input names a session, so nothing renames it afterwards. Pi has no
   command that clears a name, so do not document one.
4. **Text comes from Pi's entries or its input event.** Never the latest message, never an inference.
5. **Injected context is refused by shape.** Text starting with `<` is wrapper text, and a name made of it
   describes nothing.
6. **Cut by code point, and pay for the ellipsis out of the budget.** `[...text]`, never `text.slice()`, and the
   result is never longer than `chars`.
7. **Guard the API, do not guess the version.** `setSessionName` and `getSessionName` are checked at load, so an
   older Pi degrades to silence instead of throwing from an event handler. The README states the version this was
   tested on, which is a fact, rather than the versions it is assumed to support, which is not.
8. **The session is read once.** `getBranch()` copies the whole path and `getEntries()` copies the whole session,
   so both belong in `session_start`. The input handler runs on every message and may only compare a name and a
   flag. The earlier shape called `getBranch()` twice per message, which on a 5,000-entry session allocated 10,000
   entry references to answer a question whose answer could not change.
9. **A bad config refuses by name.** File, key, value, and what is valid.
10. **Nothing about the machine.** See below.

## The map

| file | what lives there |
|---|---|
| `src/index.ts` | the two hooks, the one branch read, the name-once flag, `getSessionName` and `setSessionName` |
| `src/hint.mjs` | `firstPrompt`, `promptText`, `hasUserTurn`, `isInjected`, `condense` |
| `src/config.mjs` | the `chars` setting and the refusals |
| `test/` | 28 checks, no terminal, no network |
| `scripts/prepublish.mjs` | the six publish checks |

## Changing things

**When a session is named** is `src/index.ts`. Both events are needed: a new session is empty at `session_start`,
so `input` carries the text that is about to become the opener, while a resumed session already has its opener in
the branch. Removing either leaves a case unnamed. The branch is snapshotted at `session_start` and never re-read,
so the input path stays O(1).

**What counts as the opener** is `firstPrompt`. **The shortening** is `condense`, where the ellipsis is paid for
out of the budget and the count is in code points. Tests assert both.

Either change alters what a name becomes for someone who changed nothing, so both are minor bumps.

## Versioning

One question decides every bump: what changes for someone who changed nothing?

| what changed | version |
|---|---|
| docs, comments, tests, no behaviour change | no bump, no tag, no publish |
| a cut splitting a character, a message type skipped by mistake, a crash, a stale constant | patch, `0.1.x` |
| a new setting, or naming from a different message or block type | minor, `0.x.0` |
| what the name becomes with an unchanged config: default length, whitespace rule, ellipsis, which messages count | minor, `0.x.0`, and the CHANGELOG says the name changes |
| removing or renaming a setting | minor, `0.x.0`, plus `### Changed` or `### Removed` naming what a user must edit |
| `1.0.0` | a maintainer decision, never a quiet commit |

The version number is not a progress bar. A one-line fix that makes a name correct is a patch.

## While developing

Work stays uncommitted until a version is ready to cut. `git diff` is the record while a change is in progress, and
the history is what someone reads to understand a release. One commit per release, plus the tag on it. An
unpublished version is fixed by editing and squashing, not by stacking corrective commits.

## Releasing

The tag and `package.json`'s version are one fact and get created together.

```bash
npm test                              # 28 checks, no terminal
pi -e . -p "Reply with exactly: ok"   # loads the extension for real, once
npm version patch --no-git-tag-version
git commit -m "…what changed…" && git tag -a vX.Y.Z -m "pi-footer-hint X.Y.Z"
git push origin HEAD && git push origin vX.Y.Z
npm publish                           # `npm login` is a human step and is never scripted
```

- **A tag is never moved once anything is published.** npm caches by commit sha, so a re-pointed tag publishes
  nothing and nobody is told. A bad release is a new patch version.
- **A failed `npm publish` is retried, never re-tagged.** Auth is the usual reason it failed.
- **`git push --tags` is not the push.** It sends whatever stale tags exist.

Before the first publish, the history and the tag can still be squashed, because no consumer can have resolved
them:

```bash
git checkout --orphan release-0.1.0 && git add -A && git commit -m "Initial commit"
git branch -M master && git tag -f -a vX.Y.Z -m "pi-footer-hint X.Y.Z"
```

Check the squashed tree against the old head before pushing: `git diff <old-head> HEAD` must be empty.
`npm publish` is the line. After it, the fix is `X.Y.(Z+1)`.

## The CHANGELOG

- Written in the same commit as the bump. A version's entry is frozen with its tag.
- A bug fixed before the release is not an entry. No user had it.
- Only `Added`, `Changed`, `Fixed`, `Removed`. A change to what the name becomes says so in the entry.
- An initial release is one sentence. Bullets start when a version changes something.
- A gap is missing capability, and this package has none. Its two limits, a name that does not track the session
  and a fixed truncation, are stated in the README where a user will see them.

## `npm publish`

`prepublishOnly` runs `scripts/prepublish.mjs`, so none of this is a step anyone has to remember.

| check | why |
|---|---|
| no host package in `dependencies`, every peer range `*` | a copy bypasses Pi's module mapping |
| the tree is committed | a publish from a dirty tree ships code no commit describes |
| `HEAD` is tagged `v<version>` | the tag and the version are one fact |
| the suite is green | no terminal, no network |
| no `test/`, `scripts/`, `AGENTS.md` or `node_modules/` in the tarball | `files` is easy to widen by accident |
| no absolute home path in a shipped file | the tarball is what people download |

Run it by hand with `node scripts/prepublish.mjs`. It writes nothing outside a temp directory and never publishes.
`npm publish --dry-run` exercises the same path, which is why the script clears `npm_config_dry_run` for its own
children: a dry run passes it down and its own `npm pack` then builds nothing.

## When npm demands a second factor

- **A "stage only" token does not fail.** `npm publish` prints `+ pi-footer-hint@0.1.0`, exits 0, the registry
  answers 202, and it records `0.0.0-stage`: a placeholder nothing can install. 201 is a real publish.
- **A bypass-2FA token cannot unpublish** (403). Such a placeholder is removed in the browser.
- **From January 2027 npm disables bypass-2FA publishing.** Trusted Publishing from CI, or `npm stage publish`
  plus a browser approval, becomes the path.

## Nothing about the machine

The repository and the tarball are public, so neither may contain evidence of where it was written:

- no names of private projects, deployments, units, services or repositories, and no paths to them;
- no `/home/...` or `~/...` paths except ones a user is meant to use, such as `~/.pi/agent/pi-footer-hint.json`;
- no real key, token, hostname, or piece of someone's data in a test;
- no "the owner", "our system" or "the brain". Say the session, the deployment, or the user.

The author's handles in `package.json` are the exception, because a package should name its maintainer.

## Traps already paid for

- **The first two versions were the wrong feature.** The name was read as "advice in the footer" and built as
  contextual hints, then as a status row. What belongs here is `pi.setSessionName()`: the name Pi already draws at
  the end of the path line. Ask what the thing shows before writing a catalogue.
- **`session_start` alone leaves a new session unnamed.** It fires before the first message exists, so `input`
  carries the text that is about to become the opener.
- **A UTF-16 cut splits an emoji**, leaving a lone surrogate in the footer. `condense` counts code points.
- **The ellipsis was added on top of the budget**, so `chars: 80` produced 81 columns. It costs one of the 80.
- **"Pi shows the session name in the footer" is Pi's behaviour, not this package's.** Say which is which, or the
  README reads as though the extension redraws the footer.

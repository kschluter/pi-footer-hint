# pi-footer-hint

Appends the first 80 characters of your first message to the footer path line. A name you set with `/name` wins and
is never overwritten.

The footer path line, before and after:

```
~/app (main)
~/app (main) • move the retry logic into the fetch wrapper
```

## Install

```
pi install npm:pi-footer-hint        # global: ~/.pi/agent/settings.json
pi install -l npm:pi-footer-hint     # per project: .pi/settings.json
```

## Configure

`~/.pi/agent/pi-footer-hint.json`, `chars` from 10 to 200, 80 by default:

```json
{ "chars": 80 }
```

The name is set on the first turn and does not follow the session. A long one is cut at `chars`, so a narrow pane
cuts it further.

Tested on pi 1.4.0.

---
name: dragonhold-artifact-sync
description: "Republish the Dragonhold artifact after every game change or detected change (incl. \"check g\" pulls)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 67a3d495-208d-4d33-8eec-d4689ab81fc7
  modified: 2026-11-05T15:20:16.278Z
---

The user wants the Dragonhold artifact (https://claude.ai/artifact/LTKxjjNePUhRcnXkgvdhyg) updated **every time** the game changes: after any edit I make, and whenever I detect a change (e.g. a `git pull` / "check g" brings in Google AI Studio's commits).

How: copy `C:\Users\gavin\Dragonhold\index.html` + `js\*.js` into the scratchpad (publish sources must be under cwd or scratchpad), publish with that `url`, `file_path` = index.html, `files` mapping `js/<name>.js`. Never publish server files or `server/dev.key`. Then run `powershell -File C:\Users\gavin\.claude\hooks\dragonhold-artifact-check.ps1 -MarkPublished` to record what's published.

To detect changes: run `powershell -File C:\Users\gavin\.claude\hooks\dragonhold-artifact-check.ps1` (prints a reminder JSON only if files differ from the last publish or GitHub is ahead). A UserPromptSubmit hook for it was proposed in `~/.claude/settings.json` but the edit was blocked (2026-11-05); only add it if the user approves.

**Why:** the user plays/shares the artifact and wants it to always match the latest game.
**How to apply:** at the start of any Dragonhold task, check; at the end, republish. Artifact is solo-only (no co-op/dev options). See [[dragonhold-project]], [[check-g-command]].

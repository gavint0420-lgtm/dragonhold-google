# Working on Dragonhold (for every AI agent)

Two AI agents share this project through its GitHub repository: Claude Code on the owner's computer, and an AI on a website. The owner is a young player, so keep messages short and simple.

**Read `AI_GUIDE.md` first.** It explains how the game's code works.

## Take turns, and always start from the newest version

1. **Before you change anything,** get the latest code: pull from GitHub (`git pull`), or start from the newest commit on `main`.
2. **Make one focused change,** and test it. See "How we test" in `AI_GUIDE.md`.
3. **Save it to GitHub right away:** commit with a short message that says what changed, for example `Add frost staff to Frosthold trader`, and push to `main`. If you can't push to `main`, open a pull request and tell the owner.
4. Don't hold changes for a long time. The other agent may be working next.

If GitHub says your copy is behind, pull first and keep both agents' changes. Never overwrite or revert work you didn't make unless the owner asks.

## Pushing to `main` updates the live game

The game runs 24/7 on Render (set up by `render.yaml`). Every push to `main` is deployed there automatically within a few minutes, and players see the "Save and update" bar. So only push code you've tested. The server must keep working with plain `node server/server.js` (no packages to install) and read its port from `PORT`.

## Never

- Add or commit `server/dev.key`. It's private and listed in `.gitignore`.
- Commit the `download/` folder. It's rebuilt automatically.
- Break old saves: add defaults for new saved fields (see "Saving" in `AI_GUIDE.md`).

## Tell the owner when you're done

Say what you changed, whether you tested it, and that it's saved to GitHub. The owner's running game shows a "Save and update" bar once the new files are on their computer.

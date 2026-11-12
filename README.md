# Run It

**Your agent writes the start command. You press play.**

```sh
# .run — written by the agent at the project root
uv sync && uv run python -m backend
```

Open the project in Cursor or VS Code, click **▶ Run** in the status bar, and the app starts in a terminal. Click **■ Stop** to end it.

## Quick Start

```sh
gh release download --repo levensailor/runit --pattern '*.vsix' --clobber
cursor --install-extension runit-*.vsix
```

Using VS Code? Swap `cursor` for `code`. Then drop a `.run` file in any project:

```sh
echo "npm run app" > .run
```

The play button appears within a second.

## What you get

| Feature | Behavior |
| --- | --- |
| Status bar play button | Shows when a workspace folder has a `.run` file; hidden otherwise |
| Play / Stop toggle | Click to start; the same button stops it while the command is running |
| Multi-root workspaces | One click opens a picker listing each project and its command |
| Editor Run menu | **Run It: Run** sits in the editor title ▶ dropdown |
| Explorer context menu | Right-click `.run` and choose **Run It: Run** |
| Live reload of `.run` | Edits are picked up on the next click; saving never auto-starts anything |
| Trusted workspaces only | Disabled in Restricted Mode, since `.run` is a shell command |

Commands in the palette: **Run It: Run**, **Run It: Stop**, **Run It: Restart**.

## The `.run` format

Plain shell, one file at the root of each workspace folder.

- Blank lines and lines starting with `#` are ignored.
- Remaining lines are joined with ` && `, so a failing step stops the chain.
- The command runs in your normal integrated terminal, from the folder that holds `.run`, with your usual shell profile and `PATH`.

```sh
# frontend
npm install
npm run dev
```

That runs `npm install && npm run dev`.

## Tell your agent

Add this to a Cursor rule or `AGENTS.md` so every project gets a `.run`:

```md
When the project has a runnable entrypoint, write the single shell command that
installs dependencies and starts the app to `.run` at the project root.
Examples: `uv sync && uv run python -m backend`, `npm run app`, `./run.sh`.
Update `.run` whenever the entrypoint changes.
```

## Logs

Output lives in the **Run It** output channel. A rotating log file (`runit.log`, 1 MB, 3 backups) sits in the extension's global storage folder; its path is printed on activation.

## Build and release

Pushes to `main` run tests and package a `.vsix` in [GitHub Actions](https://github.com/levensailor/runit/actions). Tag a version to publish a release:

```sh
npm version patch
git push origin main --follow-tags
```

The tag must match `version` in `package.json`. Releases: [github.com/levensailor/runit/releases](https://github.com/levensailor/runit/releases).

## Author

[![levensailor on GitHub](https://img.shields.io/badge/GitHub-levensailor-181717?style=for-the-badge&logo=github)](https://github.com/levensailor)

MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md) to propose changes.

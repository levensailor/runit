# Dot Run

**Your agent writes the start command. You press play.**

```sh
# .run — kept up to date by your coding agent
uv sync && uv run python -m backend
```

Open the project in Cursor or VS Code, click **▶ Run** in the status bar, and the app starts in a terminal. Click **■ Stop** to end it.

## Quick Start

Install **Dot Run** from the Extensions view (search `levensailor.runit`), or from the command line:

```sh
cursor --install-extension levensailor.runit
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
| Agent rule built in | Copilot gets the `.run` rule on install; Cursor and other agents get it through `AGENTS.md` or the Cursor plugin |
| Trusted workspaces only | Disabled in Restricted Mode, since `.run` is a shell command |

Commands in the palette: **Run It: Run**, **Run It: Stop**, **Run It: Restart**, **Run It: Add Agent Rule to AGENTS.md**.

## Teaching your agent

Agents need to know `.run` exists. Dot Run covers each editor differently:

| Agent | How it learns the rule |
| --- | --- |
| GitHub Copilot (VS Code) | Automatic. The extension ships the rule as Copilot chat instructions |
| Cursor, Claude Code, Codex, others | When a project has no `.run`, Dot Run offers to add a short section to `AGENTS.md`. One click, committed with the repo |
| Cursor, every project at once | Install the **dotrun** Cursor plugin, which carries the same rule as an always-on Cursor rule |

The `AGENTS.md` section sits between `<!-- dotrun:start -->` and `<!-- dotrun:end -->` markers. Running **Run It: Add Agent Rule to AGENTS.md** again refreshes it in place. Turn the prompt off with the `runit.offerAgentRule` setting, or choose **Never ask**.

The rule text lives in [`prompts/dotrun.instructions.md`](prompts/dotrun.instructions.md) and [`rules/dotrun.mdc`](rules/dotrun.mdc); a test keeps the two identical.

### Cursor plugin

This repository is also a Cursor plugin (`.cursor-plugin/plugin.json` + `rules/`). Until it is listed in the Cursor Marketplace, install it locally:

```sh
git clone https://github.com/levensailor/runit ~/.cursor/plugins/local/dotrun
```

Restart Cursor, and the rule shows up under Settings → Rules.

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

## Logs

Output lives in the **Run It** output channel. A rotating log file (`runit.log`, 1 MB, 3 backups) sits in the extension's global storage folder; its path is printed on activation.

## Build and publish

Pushes to `main` run tests and package a `.vsix` in [GitHub Actions](https://github.com/levensailor/runit/actions). Tagging a version runs `publish.yml`, which creates a [GitHub release](https://github.com/levensailor/runit/releases) and publishes to the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=levensailor.runit) and [Open VSX](https://open-vsx.org/extension/levensailor/runit) (the registry Cursor installs from):

```sh
npm version minor
git push origin main --follow-tags
```

Each registry step needs a repository secret and is skipped with a warning when it is missing:

| Secret | Where to get it |
| --- | --- |
| `VSCE_PAT` | Azure DevOps personal access token with **Marketplace › Manage** scope, for publisher `levensailor` |
| `OVSX_PAT` | Access token from [open-vsx.org/user-settings/tokens](https://open-vsx.org/user-settings/tokens) |

The tag must match `version` in `package.json`.

## Author

[![levensailor on GitHub](https://img.shields.io/badge/GitHub-levensailor-181717?style=for-the-badge&logo=github)](https://github.com/levensailor)

MIT licensed. See [CONTRIBUTING.md](CONTRIBUTING.md) to propose changes.

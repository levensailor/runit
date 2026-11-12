import * as vscode from 'vscode';
import { AGENTS_FILE_NAME, hasAgentsSection, stripFrontmatter, upsertAgentsSection } from './agentsRule';
import type { Logger } from './logger';

const RULE_SOURCE = ['prompts', 'dotrun.instructions.md'];
const CONFIG_SECTION = 'runit';
const CONFIG_OFFER = 'offerAgentRule';
const NEVER_KEY = 'runit.agentRule.never';
const DISMISSED_KEY = 'runit.agentRule.dismissed';
const LISTING_NAME = 'Dot Run';

const ADD = 'Add to AGENTS.md';
const NOT_HERE = 'Not for this workspace';
const NEVER = 'Never ask';

export class AgentRuleOffer {
  private offered = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly log: Logger,
  ) {}

  async maybeOffer(foldersWithoutRunFile: vscode.WorkspaceFolder[]): Promise<void> {
    if (this.offered || foldersWithoutRunFile.length === 0) {
      return;
    }
    if (!vscode.workspace.getConfiguration(CONFIG_SECTION).get<boolean>(CONFIG_OFFER, true)) {
      return;
    }
    if (this.context.globalState.get<boolean>(NEVER_KEY) || this.context.workspaceState.get<boolean>(DISMISSED_KEY)) {
      return;
    }

    const missing: vscode.WorkspaceFolder[] = [];
    for (const folder of foldersWithoutRunFile) {
      if (!hasAgentsSection(await this.readAgents(folder))) {
        missing.push(folder);
      }
    }
    if (missing.length === 0) {
      return;
    }

    this.offered = true;
    const where = missing.length === 1 ? missing[0].name : `${missing.length} projects`;
    const choice = await vscode.window.showInformationMessage(
      `${LISTING_NAME}: add a short section to ${AGENTS_FILE_NAME} in ${where} so your agent writes the start command to .run?`,
      ADD,
      NOT_HERE,
      NEVER,
    );
    this.log.info(`Agent rule offer for ${where}: ${choice ?? 'dismissed'}`);

    if (choice === ADD) {
      await this.addToFolders(missing);
    } else if (choice === NOT_HERE) {
      await this.context.workspaceState.update(DISMISSED_KEY, true);
    } else if (choice === NEVER) {
      await this.context.globalState.update(NEVER_KEY, true);
    }
  }

  async runCommand(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      void vscode.window.showInformationMessage(`${LISTING_NAME}: open a folder first.`);
      return;
    }
    let selected = [...folders];
    if (folders.length > 1) {
      const picks = await vscode.window.showQuickPick(
        folders.map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder, picked: true })),
        { canPickMany: true, placeHolder: `Add the ${LISTING_NAME} section to ${AGENTS_FILE_NAME} in...` },
      );
      if (!picks || picks.length === 0) {
        return;
      }
      selected = picks.map((p) => p.folder);
    }
    await this.addToFolders(selected);
  }

  private async addToFolders(folders: vscode.WorkspaceFolder[]): Promise<void> {
    let body: string;
    try {
      body = await this.ruleBody();
    } catch (err) {
      this.log.error('Failed to read bundled agent rule', err);
      void vscode.window.showErrorMessage(`${LISTING_NAME}: could not read the bundled agent rule.`);
      return;
    }

    const written: vscode.Uri[] = [];
    for (const folder of folders) {
      const uri = vscode.Uri.joinPath(folder.uri, AGENTS_FILE_NAME);
      try {
        const updated = upsertAgentsSection(await this.readAgents(folder), body);
        await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(updated));
        written.push(uri);
        this.log.info(`Wrote ${LISTING_NAME} section to ${uri.fsPath}`);
      } catch (err) {
        this.log.error(`Failed to update ${uri.fsPath}`, err);
        void vscode.window.showErrorMessage(`${LISTING_NAME}: could not update ${AGENTS_FILE_NAME} in ${folder.name}.`);
      }
    }
    if (written.length === 0) {
      return;
    }

    const open = await vscode.window.showInformationMessage(
      `${LISTING_NAME}: updated ${AGENTS_FILE_NAME} in ${written.length} project(s).`,
      'Open',
    );
    if (open) {
      await vscode.window.showTextDocument(written[0]);
    }
  }

  private async readAgents(folder: vscode.WorkspaceFolder): Promise<string | undefined> {
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, AGENTS_FILE_NAME));
      return new TextDecoder('utf-8').decode(bytes);
    } catch {
      return undefined;
    }
  }

  private async ruleBody(): Promise<string> {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(this.context.extensionUri, ...RULE_SOURCE));
    return stripFrontmatter(new TextDecoder('utf-8').decode(bytes));
  }
}

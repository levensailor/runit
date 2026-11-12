import * as vscode from 'vscode';
import { Logger } from './logger';
import { RUN_FILE_NAME, readRunCommand, runFileUri } from './runfile';
import { Runner } from './runner';

const EXTENSION_NAME = 'Run It';
const CONTEXT_HAS_RUN_FILE = 'runit.hasRunFile';
const CONTEXT_IS_RUNNING = 'runit.isRunning';
const STATUS_CLICK_COMMAND = 'runit.statusClick';

interface RunTarget {
  folder: vscode.WorkspaceFolder;
  command: string;
}

let log: Logger;
let runner: Runner;
let statusItem: vscode.StatusBarItem;
let targets: RunTarget[] = [];
let folderWatchers: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext): void {
  const channel = vscode.window.createOutputChannel(EXTENSION_NAME);
  log = new Logger(context.globalStorageUri.fsPath, channel);
  log.info(`Activated; log file at ${log.logFilePath}`);

  runner = new Runner(log);
  statusItem = vscode.window.createStatusBarItem('runit.status', vscode.StatusBarAlignment.Left, 100);
  statusItem.name = EXTENSION_NAME;
  statusItem.command = STATUS_CLICK_COMMAND;

  context.subscriptions.push(
    channel,
    runner,
    statusItem,
    { dispose: () => folderWatchers.forEach((w) => w.dispose()) },
    runner.onDidChange(() => updateUi()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      watchFolders();
      void refresh();
    }),
    vscode.commands.registerCommand('runit.run', (uri?: vscode.Uri) => runCommand(uri)),
    vscode.commands.registerCommand('runit.stop', () => stopCommand()),
    vscode.commands.registerCommand('runit.restart', () => restartCommand()),
    vscode.commands.registerCommand(STATUS_CLICK_COMMAND, () => statusClick()),
  );

  watchFolders();
  void refresh();
}

export function deactivate(): void {
  log?.info('Deactivated');
}

function watchFolders(): void {
  folderWatchers.forEach((w) => w.dispose());
  folderWatchers = (vscode.workspace.workspaceFolders ?? []).map((folder) => {
    const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, RUN_FILE_NAME));
    const onEvent = (kind: string) => () => {
      log.info(`${RUN_FILE_NAME} ${kind} in ${folder.name}`);
      void refresh();
    };
    watcher.onDidCreate(onEvent('created'));
    watcher.onDidChange(onEvent('changed'));
    watcher.onDidDelete(onEvent('deleted'));
    return watcher;
  });
}

async function loadTargets(): Promise<RunTarget[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const found = await Promise.all(
    folders.map(async (folder) => {
      const command = await readRunCommand(vscode.workspace.fs, folder.uri);
      return command ? { folder, command } : undefined;
    }),
  );
  return found.filter((t): t is RunTarget => t !== undefined);
}

async function refresh(): Promise<void> {
  try {
    targets = await loadTargets();
    log.debug(`Found ${targets.length} ${RUN_FILE_NAME} target(s)`);
  } catch (err) {
    log.error(`Failed to read ${RUN_FILE_NAME} files`, err);
    targets = [];
  }
  updateUi();
}

function sameFolder(a: vscode.WorkspaceFolder, b: vscode.WorkspaceFolder): boolean {
  return a.uri.toString() === b.uri.toString();
}

function targetFor(folder: vscode.WorkspaceFolder): RunTarget | undefined {
  return targets.find((t) => sameFolder(t.folder, folder));
}

function actionableFolders(): vscode.WorkspaceFolder[] {
  const folders = targets.map((t) => t.folder);
  for (const folder of runner.runningFolders()) {
    if (!folders.some((f) => sameFolder(f, folder))) {
      folders.push(folder);
    }
  }
  return folders;
}

function updateUi(): void {
  const running = runner.runningFolders();
  const folders = actionableFolders();
  void vscode.commands.executeCommand('setContext', CONTEXT_HAS_RUN_FILE, targets.length > 0);
  void vscode.commands.executeCommand('setContext', CONTEXT_IS_RUNNING, running.length > 0);

  if (folders.length === 0) {
    statusItem.hide();
    return;
  }

  if (folders.length === 1) {
    const folder = folders[0];
    const command = targetFor(folder)?.command;
    const verb = runner.isRunning(folder) ? 'Stop' : 'Run';
    statusItem.text = verb === 'Stop' ? '$(primitive-square) Stop' : '$(play) Run';
    statusItem.tooltip = `${verb} ${folder.name}${command ? `\n${command}` : ''}`;
  } else {
    statusItem.text = running.length > 0 ? `$(play) Run (${running.length} running)` : '$(play) Run';
    statusItem.tooltip = `${EXTENSION_NAME}: ${targets.length} project(s) with ${RUN_FILE_NAME}`;
  }
  statusItem.show();
}

async function freshCommand(folder: vscode.WorkspaceFolder): Promise<string | undefined> {
  const command = await readRunCommand(vscode.workspace.fs, folder.uri);
  if (!command) {
    void vscode.window.showWarningMessage(`${EXTENSION_NAME}: ${folder.name} has no command in ${RUN_FILE_NAME}.`);
    log.warn(`No command in ${RUN_FILE_NAME} for ${folder.name}`);
  }
  return command;
}

async function startFolder(folder: vscode.WorkspaceFolder): Promise<void> {
  const command = await freshCommand(folder);
  if (command) {
    runner.start(folder, command);
  }
  await refresh();
}

interface FolderPick extends vscode.QuickPickItem {
  folder: vscode.WorkspaceFolder;
  running: boolean;
}

async function pickFolder(placeHolder: string, folders: vscode.WorkspaceFolder[]): Promise<FolderPick | undefined> {
  const items: FolderPick[] = folders.map((folder) => {
    const running = runner.isRunning(folder);
    const target = targetFor(folder);
    return {
      label: `${running ? '$(primitive-square)' : '$(play)'} ${folder.name}`,
      description: running ? 'running — select to stop' : undefined,
      detail: target?.command,
      folder,
      running,
    };
  });
  return vscode.window.showQuickPick(items, { placeHolder });
}

function isNestedRunFile(uri: vscode.Uri): boolean {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  return (
    !!folder &&
    uri.path.endsWith(`/${RUN_FILE_NAME}`) &&
    uri.toString() !== runFileUri(folder.uri).toString()
  );
}

async function runCommand(uri?: vscode.Uri): Promise<void> {
  await refresh();
  if (uri && isNestedRunFile(uri)) {
    void vscode.window.showWarningMessage(
      `${EXTENSION_NAME}: only ${RUN_FILE_NAME} at a workspace folder root is used.`,
    );
    return;
  }
  const fromUri = uri ? vscode.workspace.getWorkspaceFolder(uri) : undefined;
  const direct = fromUri && targetFor(fromUri);
  if (direct) {
    return startFolder(direct.folder);
  }
  if (targets.length === 0) {
    void vscode.window.showInformationMessage(`${EXTENSION_NAME}: no ${RUN_FILE_NAME} file found in this workspace.`);
    return;
  }
  if (targets.length === 1) {
    return startFolder(targets[0].folder);
  }
  const pick = await pickFolder('Select a project to run', targets.map((t) => t.folder));
  if (pick) {
    await startFolder(pick.folder);
  }
}

async function stopCommand(): Promise<void> {
  const running = runner.runningFolders();
  if (running.length === 0) {
    void vscode.window.showInformationMessage(`${EXTENSION_NAME}: nothing is running.`);
    return;
  }
  const folder = running.length === 1 ? running[0] : (await pickFolder('Select a project to stop', running))?.folder;
  if (folder) {
    runner.stop(folder);
  }
}

async function restartCommand(): Promise<void> {
  const running = runner.runningFolders();
  if (running.length === 1) {
    return startFolder(running[0]);
  }
  if (running.length > 1) {
    const pick = await pickFolder('Select a project to restart', running);
    if (pick) {
      await startFolder(pick.folder);
    }
    return;
  }
  return runCommand();
}

async function statusClick(): Promise<void> {
  const folders = actionableFolders();
  const folder =
    folders.length === 1 ? folders[0] : (await pickFolder('Run or stop a project', folders))?.folder;
  if (!folder) {
    return;
  }
  if (runner.isRunning(folder)) {
    runner.stop(folder);
  } else {
    await startFolder(folder);
  }
}

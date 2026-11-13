import * as vscode from 'vscode';
import type { Logger } from './logger';

const SHELL_INTEGRATION_TIMEOUT_MS = 3000;
const TERMINAL_NAME_PREFIX = 'Dot Run';

interface Session {
  folder: vscode.WorkspaceFolder;
  terminal: vscode.Terminal;
  execution?: vscode.TerminalShellExecution;
  running: boolean;
}

export class Runner implements vscode.Disposable {
  private readonly sessions = new Map<string, Session>();
  private readonly changeEmitter = new vscode.EventEmitter<void>();
  private readonly disposables: vscode.Disposable[] = [];

  readonly onDidChange = this.changeEmitter.event;

  constructor(private readonly log: Logger) {
    this.disposables.push(
      this.changeEmitter,
      vscode.window.onDidCloseTerminal((terminal) => this.handleTerminalClosed(terminal)),
      vscode.window.onDidEndTerminalShellExecution((event) => this.handleExecutionEnded(event)),
    );
  }

  isRunning(folder: vscode.WorkspaceFolder): boolean {
    return this.sessions.get(folder.uri.toString())?.running ?? false;
  }

  runningFolders(): vscode.WorkspaceFolder[] {
    return [...this.sessions.values()].filter((s) => s.running).map((s) => s.folder);
  }

  start(folder: vscode.WorkspaceFolder, command: string): void {
    const key = folder.uri.toString();
    const previous = this.sessions.get(key);
    if (previous) {
      this.log.info(`Replacing existing terminal for ${folder.name}`);
      this.sessions.delete(key);
      previous.terminal.dispose();
    }

    const terminal = vscode.window.createTerminal({
      name: `${TERMINAL_NAME_PREFIX} (${folder.name})`,
      cwd: folder.uri,
      iconPath: new vscode.ThemeIcon('play'),
    });
    const session: Session = { folder, terminal, running: true };
    this.sessions.set(key, session);
    terminal.show();
    this.log.info(`Starting ${folder.name}: ${command}`);
    this.execute(session, command);
    this.changeEmitter.fire();
  }

  stop(folder: vscode.WorkspaceFolder): void {
    const key = folder.uri.toString();
    const session = this.sessions.get(key);
    if (!session) {
      return;
    }
    this.log.info(`Stopping ${folder.name}`);
    this.sessions.delete(key);
    session.terminal.dispose();
    this.changeEmitter.fire();
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }

  private execute(session: Session, command: string): void {
    const { terminal } = session;
    if (terminal.shellIntegration) {
      session.execution = terminal.shellIntegration.executeCommand(command);
      return;
    }

    let sent = false;
    const send = (integration?: vscode.TerminalShellIntegration) => {
      if (sent) {
        return;
      }
      sent = true;
      listener.dispose();
      clearTimeout(timer);
      if (this.sessions.get(session.folder.uri.toString()) !== session) {
        return;
      }
      if (integration) {
        session.execution = integration.executeCommand(command);
      } else {
        this.log.warn(`Shell integration unavailable for ${session.folder.name}; sending text directly`);
        terminal.sendText(command, true);
      }
    };
    const listener = vscode.window.onDidChangeTerminalShellIntegration((event) => {
      if (event.terminal === terminal) {
        send(event.shellIntegration);
      }
    });
    const timer = setTimeout(() => send(terminal.shellIntegration), SHELL_INTEGRATION_TIMEOUT_MS);
  }

  private handleExecutionEnded(event: vscode.TerminalShellExecutionEndEvent): void {
    for (const session of this.sessions.values()) {
      if (session.execution && session.execution === event.execution) {
        session.running = false;
        session.execution = undefined;
        this.log.info(`${session.folder.name} exited with code ${event.exitCode ?? 'unknown'}`);
        this.changeEmitter.fire();
        return;
      }
    }
  }

  private handleTerminalClosed(terminal: vscode.Terminal): void {
    for (const [key, session] of this.sessions) {
      if (session.terminal === terminal) {
        this.sessions.delete(key);
        this.log.info(`Terminal for ${session.folder.name} closed`);
        this.changeEmitter.fire();
        return;
      }
    }
  }
}

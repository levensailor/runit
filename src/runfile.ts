import { posix } from 'path';
import type * as vscode from 'vscode';

export const RUN_FILE_NAME = '.run';

export function parseRunCommand(text: string): string | undefined {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  return lines.length > 0 ? lines.join(' && ') : undefined;
}

export function runFileUri(folderUri: vscode.Uri): vscode.Uri {
  return folderUri.with({ path: posix.join(folderUri.path, RUN_FILE_NAME) });
}

export async function readRunCommand(fs: vscode.FileSystem, folderUri: vscode.Uri): Promise<string | undefined> {
  try {
    const bytes = await fs.readFile(runFileUri(folderUri));
    return parseRunCommand(new TextDecoder('utf-8').decode(bytes));
  } catch {
    return undefined;
  }
}

import * as fs from 'fs';
import * as path from 'path';
import type { OutputChannel } from 'vscode';

const MAX_BYTES = 1024 * 1024;
const BACKUP_COUNT = 3;
const TIME_ZONE = 'America/New_York';
const LOG_FILE_NAME = 'dotrun.log';

type Level = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const timestampFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  timeZoneName: 'short',
});

function timestamp(now: Date): string {
  const parts = Object.fromEntries(timestampFormat.formatToParts(now).map((p) => [p.type, p.value]));
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const millis = String(now.getMilliseconds()).padStart(3, '0');
  return `${parts.year}-${parts.month}-${parts.day} ${hour}:${parts.minute}:${parts.second}.${millis} ${parts.timeZoneName}`;
}

function callerLocation(): { fn: string; file: string; line: string } {
  // Frames: Error, callerLocation, Logger.write, Logger.<level>, caller.
  const frame = new Error().stack?.split('\n')[4] ?? '';
  const match = frame.match(/at (?:(.+?) \()?(.*?):(\d+):\d+\)?$/);
  if (!match) {
    return { fn: '<unknown>', file: '<unknown>', line: '0' };
  }
  return { fn: match[1] ?? '<anonymous>', file: path.basename(match[2]), line: match[3] };
}

export class Logger {
  private readonly filePath: string;

  constructor(
    logDir: string,
    private readonly channel?: OutputChannel,
  ) {
    fs.mkdirSync(logDir, { recursive: true });
    this.filePath = path.join(logDir, LOG_FILE_NAME);
  }

  get logFilePath(): string {
    return this.filePath;
  }

  debug(message: string): void {
    this.write('DEBUG', message);
  }

  info(message: string): void {
    this.write('INFO', message);
  }

  warn(message: string): void {
    this.write('WARN', message);
  }

  error(message: string, err?: unknown): void {
    const detail = err instanceof Error ? `: ${err.stack ?? err.message}` : err ? `: ${String(err)}` : '';
    this.write('ERROR', message + detail);
  }

  private write(level: Level, message: string): void {
    const { fn, file, line } = callerLocation();
    const entry = `${timestamp(new Date())} ${level.padEnd(5)} [${file}:${line} ${fn}] ${message}`;
    console.log(entry);
    this.channel?.appendLine(entry);
    try {
      this.rotateIfNeeded(Buffer.byteLength(entry) + 1);
      fs.appendFileSync(this.filePath, entry + '\n');
    } catch (err) {
      console.error(`Dot Run: failed to write log file ${this.filePath}`, err);
    }
  }

  private rotateIfNeeded(incomingBytes: number): void {
    let size = 0;
    try {
      size = fs.statSync(this.filePath).size;
    } catch {
      return;
    }
    if (size + incomingBytes <= MAX_BYTES) {
      return;
    }
    fs.rmSync(`${this.filePath}.${BACKUP_COUNT}`, { force: true });
    for (let i = BACKUP_COUNT - 1; i >= 1; i--) {
      const src = `${this.filePath}.${i}`;
      if (fs.existsSync(src)) {
        fs.renameSync(src, `${this.filePath}.${i + 1}`);
      }
    }
    fs.renameSync(this.filePath, `${this.filePath}.1`);
  }
}

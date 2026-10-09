import process from 'node:process';

/** Where the server writes its few lines of output. Tests pass a silent one. */
export interface Logger {
  info: (message: string) => void;
  error: (message: string) => void;
}

export function createProcessLogger(): Logger {
  return {
    info(message: string): void {
      process.stdout.write(`${message}\n`);
    },
    error(message: string): void {
      process.stderr.write(`${message}\n`);
    },
  };
}

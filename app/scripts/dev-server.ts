/**
 * スクリプト用dev serverユーティリティ
 *
 * 専用ポートでdev serverを子プロセス起動し、終了時に自動停止する。
 */
import { spawn, type ChildProcess } from 'node:child_process';

const PORT = 5174;
export const BASE_URL = `https://localhost:${PORT}`;

let server: ChildProcess | null = null;

export type ServerLogListener = (line: string) => void;

/**
 * dev serverを起動して準備完了を待つ。
 * onServerLog を渡すとサーバーのstdout/stderrから行単位でコールバックされる。
 */
export async function startDevServer(onServerLog?: ServerLogListener): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    // detached: true で新しい process group を作る。npm run dev は内部で
    // vite を孫プロセスとして spawn するので、孫ごと殺すには group kill が必要。
    server = spawn('npm', ['run', 'dev', '--', '--port', String(PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: process.cwd(),
      detached: true,
    });

    // Ctrl+C や SIGTERM で bench プロセスが強制終了した場合でも、
    // 孫プロセスの vite を残さないようにハンドラーで確実に殺す。
    // detached: true により親が死んでも子は連動しないため必須。
    // exit code はシェル慣習 (128 + signal 番号)。
    process.on('SIGINT', () => stopDevServer(130));
    process.on('SIGTERM', () => stopDevServer(143));

    const forwardLog = (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        const trimmed = line.trim();
        if (trimmed && onServerLog) onServerLog(trimmed);
      }
    };

    server.stderr!.on('data', forwardLog);

    let started = false;
    server.stdout!.on('data', (chunk: Buffer) => {
      forwardLog(chunk);
      if (!started && chunk.toString().includes('Local:')) {
        started = true;
        resolve();
      }
    });

    server.on('error', reject);
    server.on('exit', (code) => {
      if (code !== null) reject(new Error(`Dev server exited with code ${code}`));
    });
  });
}

/** dev serverを停止してプロセスを終了する */
export function stopDevServer(exitCode = 0): never {
  if (server && server.pid !== undefined) {
    server.stdout?.destroy();
    server.stderr?.destroy();
    // process group 全体に SIGKILL を送る (npm → vite の孫プロセスも一緒に殺す)
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch {
      // すでに死んでいる場合など。無視して process.exit に進む。
    }
  }
  process.exit(exitCode);
}

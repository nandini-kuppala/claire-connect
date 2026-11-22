// Spawns worker.mjs (the Nexconn Web SDK, headless) for jobs the Platform Chat API can't do: group history reads
// and file uploads. Each call is one short-lived child process with one SDK connection as `userId` (a bot).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cfg, features } from '../config.js';
import { nexconn } from '../nexconn.js';

const WORKER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'worker.mjs');

export interface SdkHistoryMessage { id: string; senderId: string; type: string; content: any; sentAt: number; directed: string[] | null }
export type WorkerOp =
  | { op: 'history'; channelId: string; since: number; until: number; max?: number }
  | { op: 'upload'; name: string; base64: string; mime?: string };
export interface WorkerResult { ok: boolean; code?: number; error?: string; messages?: SdkHistoryMessage[]; file?: { url: string; key: string; name: string; size: number } }

const tokens = new Map<string, string>();

/** Runs the ops in one SDK session as `userId`. Throws only if the worker itself can't run or connect. */
export async function runSdkWorker(userId: string, displayName: string, ops: WorkerOp[], timeoutMs = 120_000): Promise<WorkerResult[]> {
  if (!features.nexconn) throw new Error('Nexconn is not configured');
  let token = tokens.get(userId);
  if (!token) {
    token = await nexconn.issueToken(userId, displayName);
    tokens.set(userId, token);
  }
  const payload = JSON.stringify({ appKey: cfg.nexconn.appKey, area: cfg.nexconn.area, token, ops, timeoutMs });
  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs + 10_000);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-4000)));
    child.on('error', reject);
    child.on('close', () => {
      clearTimeout(timer);
      const line = stdout.split('\n').find((l) => l.startsWith('@@RESULT@@'));
      if (line) resolve(line.slice('@@RESULT@@'.length));
      else reject(new Error(`Nexconn worker gave no result. ${stderr.split('\n').slice(-3).join(' ')}`));
    });
    child.stdin.end(payload);
  });
  const r = JSON.parse(out) as { ok: boolean; error?: string; code?: number; results?: WorkerResult[] };
  if (!r.ok) {
    if (r.code === 31004 || r.code === 31010) tokens.delete(userId); // token rejected: issue a fresh one next time
    throw new Error(r.error || 'Nexconn worker failed');
  }
  return r.results ?? [];
}

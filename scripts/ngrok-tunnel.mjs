/**
 * Open an ngrok HTTP tunnel to the local Vite port.
 * Requires NGROK_AUTHTOKEN in the environment or `.env.local`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { forward } from '@ngrok/ngrok';

const PORT = Number(process.env.VITE_DEV_PORT || 5173);
const READY_TIMEOUT_MS = Number(process.env.NGROK_READY_TIMEOUT_MS || 60_000);

/** Prefer env override, else try dual-stack hosts (Vite may bind ::1 only). */
function candidateAddrs() {
  if (process.env.VITE_DEV_HOST) {
    return [`${process.env.VITE_DEV_HOST}:${PORT}`];
  }
  return [`localhost:${PORT}`, `127.0.0.1:${PORT}`, `[::1]:${PORT}`];
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function probe(addr) {
  const url = `http://${addr}/`;
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

async function waitForDevServer() {
  const addrs = candidateAddrs();
  const deadline = Date.now() + READY_TIMEOUT_MS;
  console.log(`Waiting for Vite on ${addrs.join(' or ')}…`);

  while (Date.now() < deadline) {
    for (const addr of addrs) {
      if (await probe(addr)) return addr;
    }
    await delay(400);
  }
  throw new Error(`Timed out waiting for Vite at ${addrs.join(', ')}`);
}

loadEnvLocal();

if (!process.env.NGROK_AUTHTOKEN) {
  console.error(
    'NGROK_AUTHTOKEN is not set. Add it to `.env.local` (see `.env.example`) or export it in your shell.',
  );
  process.exit(1);
}

const addr = await waitForDevServer();

const listener = await forward({
  addr,
  authtoken_from_env: true,
});

const publicUrl = listener.url();
console.log('');
console.log(`  ngrok tunnel: ${publicUrl}`);
console.log(`  forwarding → http://${addr}`);
console.log('');

const shutdown = async () => {
  try {
    await listener.close();
  } catch {
    // ignore close races on process exit
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Keep the process alive while the tunnel is open (ngrok SDK pattern).
process.stdin.resume();

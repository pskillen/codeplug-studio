import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { unzipSync } from 'fflate';
import type { BundleFile } from './types.ts';

function toForwardSlash(p: string): string {
  return p.replace(/\\/g, '/');
}

async function walkDir(dir: string, root: string): Promise<BundleFile[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: BundleFile[] = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkDir(abs, root)));
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = toForwardSlash(path.relative(root, abs));
    const buf = await readFile(abs);
    files.push({
      path: rel,
      name: path.basename(abs),
      text: buf.toString('utf8'),
    });
  }
  return files;
}

/** Load CPS files from a directory or ZIP path. */
export async function loadBundle(inputPath: string): Promise<BundleFile[]> {
  const abs = path.resolve(inputPath);
  const info = await stat(abs);
  if (info.isDirectory()) {
    return walkDir(abs, abs);
  }
  if (!info.isFile()) {
    throw new Error(`Not a file or directory: ${inputPath}`);
  }
  const lower = abs.toLowerCase();
  if (lower.endsWith('.zip')) {
    const buf = await readFile(abs);
    const unzipped = unzipSync(new Uint8Array(buf));
    const files: BundleFile[] = [];
    for (const [entryPath, data] of Object.entries(unzipped)) {
      if (entryPath.endsWith('/')) continue;
      const name = path.posix.basename(entryPath);
      files.push({
        path: toForwardSlash(entryPath),
        name,
        text: new TextDecoder('utf8').decode(data),
      });
    }
    return files;
  }
  // Single file treated as a one-file bundle
  const buf = await readFile(abs);
  return [
    {
      path: path.basename(abs),
      name: path.basename(abs),
      text: buf.toString('utf8'),
    },
  ];
}

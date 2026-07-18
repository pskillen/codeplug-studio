import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import type { BundleFile } from '../src/types.ts';

function toForwardSlash(p: string): string {
  return p.replace(/\\/g, '/');
}

function walkDir(dir: string, root: string): BundleFile[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: BundleFile[] = [];
  for (const entry of entries) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(abs, root));
      continue;
    }
    if (!entry.isFile()) continue;
    const rel = toForwardSlash(path.relative(root, abs));
    files.push({
      path: rel,
      name: path.basename(abs),
      text: readFileSync(abs, 'utf8'),
    });
  }
  return files;
}

/** Sync load of a fixture directory for suite-time `it.each` registration. */
export function loadBundleDirSync(dir: string): BundleFile[] {
  const abs = path.resolve(dir);
  const info = statSync(abs);
  if (!info.isDirectory()) {
    throw new Error(`Expected directory: ${dir}`);
  }
  return walkDir(abs, abs);
}

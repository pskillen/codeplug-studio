import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '../../../..');
const hookFile = join(
  repoRoot,
  'src/app/components/builds/RadioWriteStepper/useRadioWriteFlow.tsx',
);
const exportPanelFile = join(repoRoot, 'src/app/components/builds/BuildRadioIoPanel.tsx');
const egressDir = join(repoRoot, 'src/app/components/egress');

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listTsFiles(path));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts')) {
      out.push(path);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const watchedFiles = [...listTsFiles(egressDir), hookFile, exportPanelFile];

describe('egress boundary (shared shell stays radio-neutral)', () => {
  for (const file of watchedFiles) {
    const label = relative(repoRoot, file);
    it(`${label} does not import radio-io protocol modules`, () => {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/radio-io\/radios\//);
    });

    it(`${label} does not call is*RadioIoProfileId`, () => {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\bis\w+RadioIoProfileId\(/);
    });

    it(`${label} does not use instanceof Protocol`, () => {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/instanceof \w+Protocol/);
    });

    it(`${label} holds no bare radio-specific numeric literals`, () => {
      const code = stripComments(readFileSync(file, 'utf8'));
      expect(code).not.toMatch(/\b(20|1500|1024)\b/);
    });
  }
});

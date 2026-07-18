#!/usr/bin/env node
/**
 * CLI: npm run verify:codeplug -- --format anytone path/to/dir-or-zip
 */
import { formatVerifyResult } from './report.ts';
import { listVerifierIds, verifyCodeplug } from './verify.ts';

function printUsage(): void {
  const formats = listVerifierIds().join(', ') || '(none registered)';
  console.error(`Usage: npm run verify:codeplug -- --format <id> <path>

Verify a CPS CSV directory or ZIP against wire-shape rules from tier-3 docs.

Options:
  --format <id>   Format plugin id (known: ${formats})
  -h, --help      Show this help

Exit codes: 0 = ok, 1 = diagnostics or usage error.
`);
}

function parseArgs(argv: string[]): { format: string; path: string } | 'help' | 'error' {
  let format = '';
  let pathArg = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-h' || a === '--help') return 'help';
    if (a === '--format') {
      format = argv[++i] ?? '';
      continue;
    }
    if (a.startsWith('--format=')) {
      format = a.slice('--format='.length);
      continue;
    }
    if (a.startsWith('-')) {
      console.error(`Unknown option: ${a}`);
      return 'error';
    }
    if (!pathArg) pathArg = a;
    else {
      console.error(`Unexpected argument: ${a}`);
      return 'error';
    }
  }
  if (!format || !pathArg) return 'error';
  return { format, path: pathArg };
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed === 'help') {
    printUsage();
    process.exit(0);
  }
  if (parsed === 'error') {
    printUsage();
    process.exit(1);
  }
  try {
    const result = await verifyCodeplug(parsed);
    const out = formatVerifyResult(result);
    if (result.ok) {
      console.log(out);
      process.exit(0);
    }
    console.error(out);
    process.exit(1);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

void main();

#!/usr/bin/env node
/**
 * CLI: npm run verify:codeplug -- --format anytone [--profile anytone-at-d890uv] path/to/dir-or-zip
 */
import { formatVerifyDetailedResult } from './report.ts';
import { listProfilesForFormat, listVerifierIds, verifyCodeplugDetailed } from './verify.ts';

function printUsage(): void {
  const formats = listVerifierIds().join(', ') || '(none registered)';
  console.error(`Usage: npm run verify:codeplug -- --format <id> [--profile <id>] <path>

Verify a CPS CSV directory or ZIP against wire-shape rules from tier-3 docs.

Options:
  --format <id>    Format plugin id (known: ${formats})
  --profile <id>   Radio profile within the format (default: format default)
  -h, --help       Show this help

Exit codes: 0 = ok, 1 = diagnostics or usage error.
`);
}

function parseArgs(
  argv: string[],
): { format: string; profile?: string; path: string } | 'help' | 'error' {
  let format = '';
  let profile = '';
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
    if (a === '--profile') {
      profile = argv[++i] ?? '';
      continue;
    }
    if (a.startsWith('--profile=')) {
      profile = a.slice('--profile='.length);
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
  if (!format || !pathArg) {
    if (format) {
      const profiles = listProfilesForFormat(format);
      if (profiles.length) {
        console.error(`Profiles for ${format}: ${profiles.join(', ')}`);
      }
    }
    return 'error';
  }
  return { format, profile: profile || undefined, path: pathArg };
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
    const result = await verifyCodeplugDetailed(parsed);
    const out = formatVerifyDetailedResult(result);
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

import type { RadioFoundryBuildIdentity } from '@core/radios/radiofoundry/firmware.ts';
import type { RadioFoundryCableBoard } from './board.ts';

/** Debug-link VERSION (RadioFoundry docs/spec/debuglink.md §3.1 at 454a5b76). Replies use 0x82. */
export const RADIOFOUNDRY_VERSION_COMMAND = 0x02;
/** How long connect waits for a VERSION reply before carrying on without one. */
export const RADIOFOUNDRY_VERSION_TIMEOUT_MS = 1000;

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Parse VERSION's key=value text. Unknown keys are ignored; bad numbers are left out; lists drop empty items. */
export function parseRadioFoundryVersionText(text: string): RadioFoundryBuildIdentity {
  const out: {
    -readonly [K in keyof RadioFoundryBuildIdentity]: RadioFoundryBuildIdentity[K];
  } = { features: [], off: [] };
  for (const rawLine of text.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (!key) continue;
    switch (key) {
      case 'proto':
      case 'git_time': {
        const n = Number.parseInt(value, 10);
        if (Number.isFinite(n)) {
          if (key === 'proto') out.proto = n;
          else out.gitTime = n;
        }
        break;
      }
      case 'git':
      case 'release':
      case 'source':
      case 'repo':
      case 'board':
      case 'preset':
      case 'codec':
        if (value) out[key] = value;
        break;
      case 'features':
        out.features = splitList(value);
        break;
      case 'off':
        out.off = splitList(value);
        break;
      default:
        break;
    }
  }
  return out;
}

/** True when `reported` (a VERSION board=) is one of the board's names, ignoring case and surrounding spaces. */
export function isRadioFoundryBoardName(board: RadioFoundryCableBoard, reported: string): boolean {
  const wanted = reported.trim().toLowerCase();
  return board.versionBoardNames.some((name) => name.toLowerCase() === wanted);
}

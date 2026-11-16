import { useState } from 'react';
import type { HexSource } from '@integrations/radio-io/debugView';
import Button from '../v2/Button.tsx';
import { MASKED_TEXT } from './HexDecValue.tsx';
import classes from './DebugTable.module.css';

export const HEX_DUMP_PAGE_BYTES = 256;
const ROW = 16;

export interface HexDumpProps {
  sources: readonly HexSource[];
  /** Sensitive ranges print `••` until true. The page owns the Show password control. */
  revealed?: boolean;
  /** Collapse runs of identical full rows to one line. */
  collapseRuns?: boolean;
}

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const addr = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;

/**
 * Text lines for one 256-byte page. `sensitive` ranges of the source are absolute addresses
 * (`source.address` + offset).
 */
export function hexDumpLines(
  source: HexSource,
  page: number,
  revealed: boolean,
  collapseRuns: boolean,
): string[] {
  const start = page * HEX_DUMP_PAGE_BYTES;
  const end = Math.min(start + HEX_DUMP_PAGE_BYTES, source.bytes.length);
  const hidden = (offset: number) =>
    !revealed &&
    (source.sensitive ?? []).some(
      (r) => source.address + offset >= r.start && source.address + offset < r.start + r.length,
    );
  const uniform = (from: number): number | undefined => {
    if (from + ROW > end) return undefined;
    const v = source.bytes[from];
    for (let i = from; i < from + ROW; i++) {
      if (source.bytes[i] !== v || hidden(i)) return undefined;
    }
    return v;
  };
  const lines: string[] = [];
  let off = start;
  while (off < end) {
    const fill = collapseRuns ? uniform(off) : undefined;
    if (fill !== undefined) {
      let j = off + ROW;
      while (uniform(j) === fill) j += ROW;
      if (j - off > ROW) {
        lines.push(
          `${addr(source.address + off)}–${addr(source.address + j - 1)}  all ${hex2(fill)} (${j - off} bytes)`,
        );
        off = j;
        continue;
      }
    }
    const rowEnd = Math.min(off + ROW, end);
    const cols: string[] = [];
    let ascii = '';
    for (let i = off; i < rowEnd; i++) {
      const b = source.bytes[i];
      if (hidden(i)) {
        cols.push(MASKED_TEXT);
        ascii += '•';
      } else {
        cols.push(hex2(b));
        ascii += b >= 32 && b <= 126 ? String.fromCharCode(b) : '.';
      }
    }
    lines.push(`${addr(source.address + off)}  ${cols.join(' ').padEnd(ROW * 3 - 1)}  ${ascii}`);
    off = rowEnd;
  }
  return lines;
}

/** Raw bytes in 256-byte pages: address, hex, ASCII. Display only; radio-neutral. */
export default function HexDump({ sources, revealed = false, collapseRuns = false }: HexDumpProps) {
  const [sourceId, setSourceId] = useState(sources[0]?.id);
  const [page, setPage] = useState(0);
  const source = sources.find((s) => s.id === sourceId) ?? sources[0];
  if (!source) return null;
  const pages = Math.max(1, Math.ceil(source.bytes.length / HEX_DUMP_PAGE_BYTES));
  const current = Math.min(page, pages - 1);
  const lines = hexDumpLines(source, current, revealed, collapseRuns);
  return (
    <div>
      {sources.length > 1 ? (
        <div className={classes.controls}>
          <label>
            Source{' '}
            <select
              className={classes.select}
              value={source.id}
              onChange={(e) => {
                setSourceId(e.target.value);
                setPage(0);
              }}
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <div className={classes.scroll}>
        <pre className={classes.pre} aria-label="Hexadecimal bytes">
          {lines.join('\n')}
        </pre>
      </div>
      <div className={classes.controls} style={{ marginTop: 8, marginBottom: 0 }}>
        <Button
          variant="secondary"
          size="sm"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
        >
          Previous
        </Button>
        <span>
          Page {current + 1} of {pages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={current + 1 >= pages}
          onClick={() => setPage(current + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

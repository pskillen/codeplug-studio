import type { UnusedRange } from '@integrations/radio-io/debugView';
import DebugSection from './DebugSection.tsx';
import classes from './DebugTable.module.css';

export interface UnusedRangesProps {
  ranges: readonly UnusedRange[];
  /** Open on first render. Default folded. */
  defaultOpen?: boolean;
  title?: string;
}

/** "1,203 bytes in 14 ranges are unused (no reader)". */
export function unusedCountLine(ranges: readonly UnusedRange[]): string {
  const bytes = ranges.reduce((sum, r) => sum + r.bytes, 0);
  const n = ranges.length;
  return `${bytes.toLocaleString('en-GB')} ${bytes === 1 ? 'byte' : 'bytes'} in ${n} ${
    n === 1 ? 'range is' : 'ranges are'
  } unused (no reader)`;
}

/** Ranges the firmware never reads, folded under a count line. Renders nothing when empty. */
export default function UnusedRanges({
  ranges,
  defaultOpen = false,
  title = 'Never read (unused)',
}: UnusedRangesProps) {
  if (ranges.length === 0) return null;
  return (
    <DebugSection
      title={title}
      description={unusedCountLine(ranges)}
      collapsible
      defaultCollapsed={!defaultOpen}
    >
      <div className={classes.scroll}>
        <table className={classes.table} aria-label={title}>
          <thead>
            <tr>
              <th scope="col">Start</th>
              <th scope="col">End</th>
              <th scope="col">Bytes</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            {ranges.map((r) => (
              <tr key={`${r.start}-${r.end}`}>
                <td className={classes.mono}>{r.start}</td>
                <td className={classes.mono}>{r.end}</td>
                <td className={classes.num}>{r.bytes.toLocaleString('en-GB')}</td>
                <td>{r.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DebugSection>
  );
}

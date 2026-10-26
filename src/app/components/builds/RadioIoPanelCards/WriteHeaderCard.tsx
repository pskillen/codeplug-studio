import { Button } from '../../v2/index.ts';
import classes from './RadioIoPanelCards.module.css';

export interface WriteHeaderCardProps {
  /** The radio's label, e.g. "AT-D890UV (MM9PDY)". */
  radioLabel: string;
  /** One line, e.g. "412 channels · 18 zones · 3 radio-setting changes"; omitted while loading. */
  summary?: string;
  disabled?: boolean;
  /** Hide the button (write disabled on this deploy); the card still names the radio. */
  writeHidden?: boolean;
  onWrite: () => void;
}

/** The Export panel's header: one primary action, "Write radio…", and a one-line build summary. */
export default function WriteHeaderCard({
  radioLabel,
  summary,
  disabled,
  writeHidden,
  onWrite,
}: WriteHeaderCardProps) {
  return (
    <section className={classes.card} aria-label={`Write to ${radioLabel}`}>
      <div className={classes.headerRow}>
        <h2 className={classes.title}>Write to {radioLabel}</h2>
        {writeHidden ? null : (
          <Button variant="primary" size="sm" disabled={disabled} onClick={onWrite}>
            Write radio…
          </Button>
        )}
      </div>
      {summary ? <p className={classes.line}>{summary}</p> : null}
    </section>
  );
}

/** "412 channels · 18 zones · 3 radio-setting changes" (settings part only when `settingChanges` is given). */
export function buildSummaryLine(input: {
  channels: number;
  zones: number;
  settingChanges?: number;
}): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    plural(input.channels, 'channel', 'channels'),
    plural(input.zones, 'zone', 'zones'),
  ];
  if (input.settingChanges !== undefined) {
    parts.push(plural(input.settingChanges, 'radio-setting change', 'radio-setting changes'));
  }
  return parts.join(' · ');
}

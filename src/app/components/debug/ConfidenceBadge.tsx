import type { Confidence } from '@integrations/radio-io/debugView';
import Pill, { type PillTone } from '../v2/Pill.tsx';

const CONFIDENCE: Record<Confidence, { label: string; tone: PillTone }> = {
  traced: { label: 'traced', tone: 'success' },
  'partially-traced': { label: 'partly traced', tone: 'warning' },
  inferred: { label: 'inferred', tone: 'warning' },
  unknown: { label: 'unknown', tone: 'neutral' },
  unused: { label: 'unused (no reader)', tone: 'neutral' },
};

export interface ConfidenceBadgeProps {
  value: Confidence;
  /** Which confidence this is, for the tooltip: "layout" or "meaning". */
  kind?: string;
}

/** Layout or meaning confidence. Never truncates: the pill does not shrink or ellipsise. */
export default function ConfidenceBadge({ value, kind }: ConfidenceBadgeProps) {
  const { label, tone } = CONFIDENCE[value];
  return (
    <span title={kind ? `${kind} confidence: ${label}` : `Confidence: ${label}`}>
      <Pill tone={tone}>{label}</Pill>
    </span>
  );
}

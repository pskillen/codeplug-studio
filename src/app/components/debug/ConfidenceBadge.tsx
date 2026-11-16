import type { Confidence } from '@integrations/radio-io/debugView';
import Pill from '../v2/Pill.tsx';
import { CONFIDENCE } from './confidence.ts';

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

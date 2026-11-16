import type { Confidence } from '@integrations/radio-io/debugView';
import type { PillTone } from '../v2/Pill.tsx';

export const CONFIDENCE: Record<Confidence, { label: string; tone: PillTone }> = {
  traced: { label: 'traced', tone: 'success' },
  'partially-traced': { label: 'partly traced', tone: 'warning' },
  inferred: { label: 'inferred', tone: 'warning' },
  unknown: { label: 'unknown', tone: 'neutral' },
  unused: { label: 'unused (no reader)', tone: 'neutral' },
};

/** The badge text for a confidence value (also what a viewer searches). */
export const confidenceLabel = (value: Confidence): string => CONFIDENCE[value].label;

import { useEffect, useState } from 'react';
import { Select, type ComboboxProps } from '@mantine/core';
import { formatDcsChannelTone, parseChannelTone, type DcsPolarity } from '@core/domain/tones.ts';
import type { ChannelTone } from '@core/models/libraryTypes.ts';
import {
  NONE_TONE,
  ctcssToneSelectOptions,
  dcsCodeSelectOptions,
} from '../../lib/channelFields/index.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';
import classes from './ChannelToneField.module.css';

type ToneKind = 'off' | 'ctcss' | 'dcs';

const KIND_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'ctcss', label: 'CTCSS' },
  { value: 'dcs', label: 'DCS' },
] as const;

const POLARITY_OPTIONS = [
  { value: 'N', label: 'Normal' },
  { value: 'I', label: 'Inverted' },
] as const;

export interface ChannelToneFieldProps {
  /** Visible label on the kind control. Omit when a parent already names the field. */
  label?: string;
  /** Accessible name when `label` is omitted (bulk edit). */
  groupLabel?: string;
  value: ChannelTone;
  onChange: (tone: ChannelTone) => void;
  comboboxProps?: ComboboxProps;
  disabled?: boolean;
}

function storedKind(tone: ChannelTone): ToneKind | 'unknown' {
  const parsed = parseChannelTone(tone);
  if (parsed.kind === 'none') return 'off';
  if (parsed.kind === 'ctcss') return 'ctcss';
  if (parsed.kind === 'dcs') return 'dcs';
  return 'unknown';
}

function paddedDcsCode(code: number): string {
  return String(code).padStart(3, '0');
}

/**
 * Analog RX/TX tone: Off, CTCSS Hz, or DCS code plus normal/inverted polarity.
 * Inverted DCS is stored as `D023I`. A legacy `D023P` displays as inverted and is
 * rewritten to `I` only when the operator changes this field.
 */
export default function ChannelToneField({
  label,
  groupLabel,
  value,
  onChange,
  comboboxProps,
  disabled = false,
}: ChannelToneFieldProps) {
  const accessibleName = label ?? groupLabel;
  const parsed = parseChannelTone(value);
  const [lastCtcss, setLastCtcss] = useState<ChannelTone | null>(() => {
    const seed = parseChannelTone(value);
    return seed.kind === 'ctcss' ? value : null;
  });
  const [lastDcs, setLastDcs] = useState<ChannelTone | null>(() => {
    const seed = parseChannelTone(value);
    return seed.kind === 'dcs' ? value : null;
  });
  const [pending, setPending] = useState<{ anchor: ChannelTone; kind: ToneKind } | null>(null);
  const [draftPolarity, setDraftPolarity] = useState<DcsPolarity>('N');

  useEffect(() => {
    const next = parseChannelTone(value);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep session tone memory aligned with the controlled value
    if (next.kind === 'ctcss') setLastCtcss(value);
    if (next.kind === 'dcs') setLastDcs(value);
  }, [value]);

  const activeKind: ToneKind | 'unknown' =
    pending && pending.anchor === value ? pending.kind : storedKind(value);

  function selectKind(next: ToneKind) {
    if (next === 'off') {
      setPending(null);
      if (parsed.kind !== 'none') onChange(NONE_TONE);
      return;
    }
    if (storedKind(value) === next) {
      setPending(null);
      return;
    }
    if (next === 'ctcss' && lastCtcss) {
      setPending(null);
      onChange(lastCtcss);
      return;
    }
    if (next === 'dcs' && lastDcs) {
      setPending(null);
      const remembered = parseChannelTone(lastDcs);
      if (remembered.kind === 'dcs') setDraftPolarity(remembered.polarity);
      onChange(lastDcs);
      return;
    }
    if (next === 'dcs') setDraftPolarity('N');
    setPending({ anchor: NONE_TONE, kind: next });
    if (parsed.kind !== 'none') onChange(NONE_TONE);
  }

  function selectHz(next: string | null) {
    if (!next) return;
    setPending(null);
    onChange(next);
  }

  function selectCode(next: string | null) {
    if (!next) return;
    const polarity = parsed.kind === 'dcs' ? parsed.polarity : draftPolarity;
    setPending(null);
    onChange(formatDcsChannelTone(Number(next), polarity));
  }

  function selectPolarity(next: DcsPolarity) {
    if (parsed.kind === 'dcs') {
      setPending(null);
      onChange(formatDcsChannelTone(parsed.code, next));
      return;
    }
    setDraftPolarity(next);
  }

  const polarity: DcsPolarity = parsed.kind === 'dcs' ? parsed.polarity : draftPolarity;
  const ctcssValue = parsed.kind === 'ctcss' ? value.trim() : null;
  const dcsCode = parsed.kind === 'dcs' ? paddedDcsCode(parsed.code) : null;

  return (
    <div
      className={classes.root}
      role={label ? undefined : 'group'}
      aria-label={label ? undefined : groupLabel}
    >
      <GradientSegmentedControl
        label={label}
        value={activeKind === 'unknown' ? '' : activeKind}
        onChange={(next) => selectKind(next as ToneKind)}
        data={KIND_OPTIONS}
        scheme="three"
        neutralValues={['off']}
        size="sm"
        fullWidth
        disabled={disabled}
      />
      {activeKind === 'unknown' ? (
        <p className={classes.unknown}>Stored value: {value.trim()}</p>
      ) : null}
      {activeKind === 'ctcss' ? (
        <Select
          aria-label={accessibleName ? `${accessibleName} frequency` : 'CTCSS frequency'}
          placeholder="Choose tone"
          data={ctcssToneSelectOptions(ctcssValue ?? undefined)}
          value={ctcssValue}
          onChange={selectHz}
          searchable
          comboboxProps={comboboxProps}
          disabled={disabled}
        />
      ) : null}
      {activeKind === 'dcs' ? (
        <>
          <Select
            aria-label={accessibleName ? `${accessibleName} code` : 'DCS code'}
            placeholder="Choose code"
            data={dcsCodeSelectOptions(dcsCode ?? undefined)}
            value={dcsCode}
            onChange={selectCode}
            searchable
            comboboxProps={comboboxProps}
            disabled={disabled}
          />
          <GradientSegmentedControl
            label="Polarity"
            value={polarity}
            onChange={(next) => selectPolarity(next as DcsPolarity)}
            data={POLARITY_OPTIONS}
            size="sm"
            fullWidth
            disabled={disabled}
          />
        </>
      ) : null}
    </div>
  );
}

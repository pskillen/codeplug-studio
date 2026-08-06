import { IconArrowsRightLeft } from '@tabler/icons-react';
import { useMemo } from 'react';
import {
  formatOffsetMhz,
  frequencyOffsetMhz,
  offsetsMatch,
  txFrequencyHzFromOffset,
  txOffsetsForFrequencyHz,
} from '@core/domain/txOffsets.ts';
import { Button } from '../v2/index.ts';
import { hzToMhzString } from '../../lib/units.ts';
import classes from './TxOffsetControls.module.css';

export interface TxOffsetControlsProps {
  rxFrequencyHz: number | null;
  txFrequencyHz: number | null;
  onTxFrequencyChange: (txMhzString: string) => void;
}

/**
 * Live TX offset display and band-appropriate quick buttons for channel Frequencies edit.
 */
export default function TxOffsetControls({
  rxFrequencyHz,
  txFrequencyHz,
  onTxFrequencyChange,
}: TxOffsetControlsProps) {
  const offsetMhz = useMemo(
    () => frequencyOffsetMhz(rxFrequencyHz, txFrequencyHz),
    [rxFrequencyHz, txFrequencyHz],
  );
  const offsetLabel = formatOffsetMhz(offsetMhz);
  const options = useMemo(() => txOffsetsForFrequencyHz(rxFrequencyHz), [rxFrequencyHz]);
  const rxValid = rxFrequencyHz != null && Number.isFinite(rxFrequencyHz);

  if (!rxValid) return null;

  const simplexActive = offsetMhz != null && offsetsMatch(offsetMhz, 0);

  return (
    <div className={classes.root}>
      {offsetLabel != null ? (
        <p className={classes.offsetLine}>
          Offset: <strong>{offsetLabel}</strong>
        </p>
      ) : (
        <p className={classes.offsetHint}>Offset: set TX to compute, or pick a quick offset</p>
      )}
      <div className={classes.quickSet}>
        <span className={classes.quickLabel}>Quick set:</span>
        <Button
          variant={simplexActive ? 'primary' : 'outline'}
          size="sm"
          leftSection={<IconArrowsRightLeft size={12} stroke={2} aria-hidden />}
          onClick={() => onTxFrequencyChange(hzToMhzString(rxFrequencyHz))}
        >
          Simplex
        </Button>
        {options
          .filter((option) => option.offsetMhz !== 0)
          .map((option) => {
            const active = offsetMhz != null && offsetsMatch(offsetMhz, option.offsetMhz);
            return (
              <Button
                key={`${option.label}:${option.offsetMhz}`}
                variant={active ? 'primary' : 'outline'}
                size="sm"
                onClick={() => {
                  const txHz = txFrequencyHzFromOffset(rxFrequencyHz, option.offsetMhz);
                  onTxFrequencyChange(hzToMhzString(txHz));
                }}
              >
                {option.label}
              </Button>
            );
          })}
      </div>
    </div>
  );
}

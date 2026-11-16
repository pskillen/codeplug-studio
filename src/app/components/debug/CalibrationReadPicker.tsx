import { Select } from '@mantine/core';
import classes from './CalibrationReadPicker.module.css';

export interface CalibrationReadPickerEntry {
  id: string;
  label: string;
  /** When the read was taken; shown in brackets after the label. */
  time?: Date;
}

export interface CalibrationReadPickerProps {
  entries: readonly CalibrationReadPickerEntry[];
  readId: string | null;
  overlayId: string | null;
  onRead: (id: string) => void;
  onOverlay: (id: string | null) => void;
}

export const NO_OVERLAY_LABEL = 'None';
const NONE = '\u0000none';

function entryLabel(e: CalibrationReadPickerEntry): string {
  return e.time ? `${e.label} (${e.time.toLocaleTimeString()})` : e.label;
}

/**
 * The **Read** and **Overlay (optional)** selects at the top of Calibration: side by side from `sm`, stacked on a
 * phone. The Overlay list leaves out the read and starts with a None option; an overlay equal to the read shows as None.
 */
export default function CalibrationReadPicker({
  entries,
  readId,
  overlayId,
  onRead,
  onOverlay,
}: CalibrationReadPickerProps) {
  const options = entries.map((e) => ({ value: e.id, label: entryLabel(e) }));
  const overlayOptions = [
    { value: NONE, label: NO_OVERLAY_LABEL },
    ...options.filter((o) => o.value !== readId),
  ];
  const overlay = overlayId !== null && overlayId !== readId ? overlayId : NONE;
  return (
    <div className={classes.root}>
      <Select
        label="Read"
        data={options}
        value={readId}
        allowDeselect={false}
        onChange={(v) => {
          if (v !== null) onRead(v);
        }}
      />
      <Select
        label="Overlay (optional)"
        data={overlayOptions}
        value={overlay}
        allowDeselect={false}
        onChange={(v) => onOverlay(v === null || v === NONE ? null : v)}
      />
    </div>
  );
}

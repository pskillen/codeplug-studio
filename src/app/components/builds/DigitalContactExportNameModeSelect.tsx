import { Select } from '@mantine/core';
import {
  DIGITAL_CONTACT_EXPORT_NAME_MODES,
  digitalContactExportNameModeLabel,
  type DigitalContactExportNameMode,
} from '@core/import-export/types.ts';

export interface DigitalContactExportNameModeSelectProps {
  value: DigitalContactExportNameMode;
  onChange: (value: DigitalContactExportNameMode) => void;
  disabled?: boolean;
  description?: string;
}

export default function DigitalContactExportNameModeSelect({
  value,
  onChange,
  disabled = false,
  description = 'How library contact fields compose CPS Name at export. Per-contact wire name overrides on this build take precedence.',
}: DigitalContactExportNameModeSelectProps) {
  return (
    <Select
      label="Contact export name style"
      description={description}
      data={DIGITAL_CONTACT_EXPORT_NAME_MODES.map((mode) => ({
        value: mode,
        label: digitalContactExportNameModeLabel(mode),
      }))}
      value={value}
      onChange={(next) => {
        if (next == null) return;
        onChange(next as DigitalContactExportNameMode);
      }}
      allowDeselect={false}
      disabled={disabled}
    />
  );
}

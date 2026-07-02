import { Select } from '@mantine/core';
import { EXPORT_NAME_MODE_OPTIONS } from '@core/domain/channelNaming.ts';
import { useExportSettings, type ExportNameModeOverride } from '../../hooks/useExportSettings.ts';

export interface ExportNameModeSelectProps {
  disabled?: boolean;
  description?: string;
}

export default function ExportNameModeSelect({
  disabled = false,
  description = 'Fallback when a channel has no wire name override on this build. Set overrides on the Channels wire page.',
}: ExportNameModeSelectProps) {
  const { nameModeOverride, setNameModeOverride } = useExportSettings();

  return (
    <Select
      label="Default export name style"
      description={description}
      data={EXPORT_NAME_MODE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
      value={nameModeOverride}
      onChange={(value) => {
        if (value == null) return;
        setNameModeOverride(value as ExportNameModeOverride);
      }}
      allowDeselect={false}
      disabled={disabled}
    />
  );
}

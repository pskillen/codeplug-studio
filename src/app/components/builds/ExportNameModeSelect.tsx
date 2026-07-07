import { Select } from '@mantine/core';
import { EXPORT_NAME_MODE_OPTIONS } from '@core/domain/channelNaming.ts';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';

export interface ExportNameModeSelectProps {
  value: ChannelExportNameMode;
  onChange: (value: ChannelExportNameMode) => void;
  disabled?: boolean;
  description?: string;
}

export default function ExportNameModeSelect({
  value,
  onChange,
  disabled = false,
  description = 'Fallback when a channel has no wire name override on this build. Set overrides on the Channels wire page.',
}: ExportNameModeSelectProps) {
  return (
    <Select
      label="Default export name style"
      description={description}
      data={EXPORT_NAME_MODE_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      }))}
      value={value}
      onChange={(next) => {
        if (next == null) return;
        onChange(next as ChannelExportNameMode);
      }}
      allowDeselect={false}
      disabled={disabled}
    />
  );
}

import { Switch } from '@mantine/core';
import { useExportSettings } from '../../hooks/useExportSettings.ts';

export interface UseChannelAbbreviationSwitchProps {
  disabled?: boolean;
}

export default function UseChannelAbbreviationSwitch({
  disabled,
}: UseChannelAbbreviationSwitchProps) {
  const { shortenNames, useChannelAbbreviation, setUseChannelAbbreviation } = useExportSettings();

  return (
    <Switch
      label="Use channel abbreviations"
      description="When shortening, try Channel.abbreviation before dictionary rules"
      checked={useChannelAbbreviation}
      onChange={(e) => setUseChannelAbbreviation(e.currentTarget.checked)}
      disabled={disabled ?? !shortenNames}
    />
  );
}

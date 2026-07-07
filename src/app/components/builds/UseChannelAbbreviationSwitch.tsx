import { Switch } from '@mantine/core';

export interface UseChannelAbbreviationSwitchProps {
  shortenNames: boolean;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function UseChannelAbbreviationSwitch({
  shortenNames,
  value,
  onChange,
  disabled,
}: UseChannelAbbreviationSwitchProps) {
  return (
    <Switch
      label="Use channel abbreviations"
      description="When shortening, try Channel.abbreviation before dictionary rules"
      checked={value}
      onChange={(e) => onChange(e.currentTarget.checked)}
      disabled={disabled ?? !shortenNames}
    />
  );
}

import { Switch } from '@mantine/core';

export interface UseLibraryAbbreviationsSwitchProps {
  shortenNames: boolean;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export default function UseLibraryAbbreviationsSwitch({
  shortenNames,
  value,
  onChange,
  disabled,
}: UseLibraryAbbreviationsSwitchProps) {
  return (
    <Switch
      label="Use abbreviations from library"
      description="When shortening, prefer Channel and Talk group abbreviation fields before dictionary rules"
      checked={value}
      onChange={(e) => onChange(e.currentTarget.checked)}
      disabled={disabled ?? !shortenNames}
    />
  );
}

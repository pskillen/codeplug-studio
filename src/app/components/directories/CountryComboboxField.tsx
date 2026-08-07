import { useMemo } from 'react';
import { REPEATERBOOK_COUNTRY_NAMES } from '@integrations/repeaters/repeaterbook/countryNames.ts';
import Combobox from '../v2/Combobox.tsx';
import FormField from '../v2/FormField.tsx';

export interface CountryComboboxFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  className?: string;
}

/**
 * Country typeahead for directory filters — v2 Combobox (C5) over the shared country list.
 */
export default function CountryComboboxField({
  label,
  value,
  onChange,
  placeholder = 'Start typing — e.g. United Kingdom',
  hint,
  className,
}: CountryComboboxFieldProps) {
  const options = useMemo(() => {
    const needle = value.trim().toLowerCase();
    const filtered = needle
      ? REPEATERBOOK_COUNTRY_NAMES.filter((country) => country.toLowerCase().includes(needle))
      : [...REPEATERBOOK_COUNTRY_NAMES];
    return filtered.slice(0, 20).map((country) => ({ value: country, label: country }));
  }, [value]);

  return (
    <FormField label={label} hint={hint} className={className}>
      <Combobox
        inputValue={value}
        onInputChange={onChange}
        options={options}
        onSelect={(option) => onChange(option.label)}
        placeholder={placeholder}
        emptyMessage="No matching countries"
      />
    </FormField>
  );
}

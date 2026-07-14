import { Text } from '@mantine/core';

export interface ExportSettingsSubheadingProps {
  children: string;
}

/** Logical grouping label inside an export settings FieldCard. */
export default function ExportSettingsSubheading({ children }: ExportSettingsSubheadingProps) {
  return (
    <Text size="sm" fw={600} mt="xs">
      {children}
    </Text>
  );
}

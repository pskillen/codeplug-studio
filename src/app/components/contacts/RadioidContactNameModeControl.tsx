import { SegmentedControl, Stack, Text } from '@mantine/core';
import {
  RADIOID_CONTACT_NAME_MODES,
  radioidContactNameModeLabel,
  type RadioidContactNameMode,
} from '@integrations/radioid/index.ts';

export interface RadioidContactNameModeControlProps {
  value: RadioidContactNameMode;
  onChange: (mode: RadioidContactNameMode) => void;
}

export default function RadioidContactNameModeControl({
  value,
  onChange,
}: RadioidContactNameModeControlProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        Import name as
      </Text>
      <SegmentedControl
        value={value}
        onChange={(next) => onChange(next as RadioidContactNameMode)}
        data={RADIOID_CONTACT_NAME_MODES.map((mode) => ({
          value: mode,
          label: radioidContactNameModeLabel(mode),
        }))}
      />
      <Text size="xs" c="dimmed">
        Uses RadioID.net&apos;s <code>name</code> field (not fname/surname). Applies to Add,
        bulk import, and update from RadioID.net.
      </Text>
    </Stack>
  );
}

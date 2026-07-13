import { useMemo } from 'react';
import { Alert, Select, Stack, Text } from '@mantine/core';
import type { AprsConfiguration } from '@core/models/aprs.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { FieldCard } from '../fields/Fields.tsx';

const UNSET_VALUE = '';

export interface BuildAprsSettingsSectionProps {
  build: FormatBuild;
  aprsConfigurations: AprsConfiguration[];
  saving: boolean;
  onActiveConfigChange: (configId: string | null) => void;
}

export default function BuildAprsSettingsSection({
  build,
  aprsConfigurations,
  saving,
  onActiveConfigChange,
}: BuildAprsSettingsSectionProps) {
  if (build.profileId !== 'anytone-at-d890uv') {
    return null;
  }

  const options = useMemo(
    () => [
      { value: UNSET_VALUE, label: 'None selected' },
      ...aprsConfigurations.map((config) => ({ value: config.id, label: config.name })),
    ],
    [aprsConfigurations],
  );

  const showUnsetWarning =
    aprsConfigurations.length > 0 && !build.activeAprsConfigurationId?.trim();

  return (
    <FieldCard
      title="APRS"
      description="Select the library APRS configuration exported as the single Anytone APRS.CSV row."
    >
      <Stack gap="sm">
        <Select
          label="Active APRS configuration"
          data={options}
          searchable
          disabled={saving || aprsConfigurations.length === 0}
          value={build.activeAprsConfigurationId ?? UNSET_VALUE}
          onChange={(value) => onActiveConfigChange(value && value !== UNSET_VALUE ? value : null)}
        />
        {aprsConfigurations.length === 0 ? (
          <Text size="sm" c="dimmed">
            Create an APRS configuration under Library → APRS configurations before exporting
            digital APRS.
          </Text>
        ) : null}
        {showUnsetWarning ? (
          <Alert color="yellow" variant="light">
            APRS configurations exist in the library but this build has no active configuration
            selected. Export will omit APRS.CSV until one is chosen.
          </Alert>
        ) : null}
      </Stack>
    </FieldCard>
  );
}

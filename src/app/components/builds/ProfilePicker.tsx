import { Card, Group, Select, Stack, Text } from '@mantine/core';
import type { FormatId } from '@core/import-export/types.ts';
import { formatProfileWireHint } from '@core/import-export/formatProfiles.ts';
import { buildProfileOptionsForFormat } from '../../routes/builds/buildHelpers.ts';
import { profilePathwayBadge } from './preferNeonPlugPathwayBadges.tsx';

export interface ProfilePickerProps {
  formatId: FormatId;
  value?: string | null;
  onChange: (profileId: string) => void;
  /** Card list for new-build wizard; select dropdown for export override and build detail. */
  mode?: 'cards' | 'select';
  label?: string;
  description?: string;
  disabled?: boolean;
}

export default function ProfilePicker({
  formatId,
  value,
  onChange,
  mode = 'cards',
  label = 'Radio profile',
  description,
  disabled = false,
}: ProfilePickerProps) {
  const profiles = buildProfileOptionsForFormat(formatId);

  if (mode === 'select') {
    const selectData = profiles.map((p) => ({
      value: p.profileId,
      label: p.hint ? `${p.label} (${p.hint})` : p.label,
    }));
    const wireHint = value ? formatProfileWireHint(formatId, value) : null;

    return (
      <Stack gap="xs">
        <Select
          label={label}
          description={description}
          data={selectData}
          value={value}
          onChange={(next) => {
            if (next) onChange(next);
          }}
          allowDeselect={false}
          disabled={disabled || profiles.length === 0}
        />
        {wireHint ? (
          <Text size="sm" c="dimmed">
            {wireHint}
          </Text>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      {profiles.map((profile) => (
        <Card
          key={profile.profileId}
          withBorder
          padding="md"
          style={{ cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}
          onClick={() => {
            if (!disabled) onChange(profile.profileId);
          }}
        >
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <div>
              <Text fw={600}>{profile.label}</Text>
              {profile.hint ? (
                <Text size="sm" c="dimmed">
                  {profile.hint}
                </Text>
              ) : null}
              {formatProfileWireHint(formatId, profile.profileId) ? (
                <Text size="sm" c="dimmed">
                  {formatProfileWireHint(formatId, profile.profileId)}
                </Text>
              ) : null}
            </div>
            {profilePathwayBadge(profile.profileId)}
          </Group>
        </Card>
      ))}
      {profiles.length === 0 ? (
        <Text size="sm" c="dimmed">
          No profiles registered for this format yet.
        </Text>
      ) : null}
    </Stack>
  );
}

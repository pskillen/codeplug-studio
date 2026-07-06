import { useCallback, useMemo, useState } from 'react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { Library } from '@core/models/library.ts';
import {
  addChannelsToZoneMembers,
  removeChannelsFromZoneMembers,
  zonesWithEffectiveChannelMembership,
} from '@core/domain/zoneMembership.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import ZoneSelect from './ZoneSelect.tsx';

export interface ChannelZoneMembershipSectionProps {
  channelId: string;
  library: Library;
}

export default function ChannelZoneMembershipSection({
  channelId,
  library,
}: ChannelZoneMembershipSectionProps) {
  const { reload } = useLibrary();
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const memberships = useMemo(
    () => zonesWithEffectiveChannelMembership(channelId, library),
    [channelId, library],
  );

  const directMemberships = useMemo(() => memberships.filter((m) => m.direct), [memberships]);
  const nestedOnlyMemberships = useMemo(() => memberships.filter((m) => !m.direct), [memberships]);

  const zonesAvailableToAdd = useMemo(() => {
    const directIds = new Set(directMemberships.map((m) => m.zone.id));
    return library.zones.filter((zone) => !directIds.has(zone.id));
  }, [directMemberships, library.zones]);

  const persistZoneMembers = useCallback(
    async (zoneId: string, nextMembers: Library['zones'][number]['members']) => {
      const zone = library.zones.find((z) => z.id === zoneId);
      if (!zone) return;
      const updated = { ...zone, members: nextMembers };
      const libraryForValidation = {
        ...library,
        zones: library.zones.map((z) => (z.id === zoneId ? updated : z)),
      };
      validateZoneMembership(zoneId, nextMembers, libraryForValidation);
      const result = await persistence.putZone(updated, zone.revision);
      if (!result.ok) {
        throw new Error(
          result.reason === 'revision_conflict'
            ? 'Zone was changed elsewhere. Reload and try again.'
            : 'Failed to update zone.',
        );
      }
      await reload();
    },
    [library, reload],
  );

  const handleAdd = useCallback(async () => {
    if (!selectedZoneId) return;
    setBusy(true);
    setError(null);
    try {
      const zone = library.zones.find((z) => z.id === selectedZoneId);
      if (!zone) return;
      const nextMembers = addChannelsToZoneMembers(zone.members, [channelId]);
      await persistZoneMembers(zone.id, nextMembers);
      setSelectedZoneId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add channel to zone');
    } finally {
      setBusy(false);
    }
  }, [channelId, library.zones, persistZoneMembers, selectedZoneId]);

  const handleRemove = useCallback(
    async (zoneId: string) => {
      setBusy(true);
      setError(null);
      try {
        const zone = library.zones.find((z) => z.id === zoneId);
        if (!zone) return;
        const nextMembers = removeChannelsFromZoneMembers(zone.members, [channelId]);
        await persistZoneMembers(zone.id, nextMembers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove channel from zone');
      } finally {
        setBusy(false);
      }
    },
    [channelId, library.zones, persistZoneMembers],
  );

  const directCount = directMemberships.length;
  const effectiveCount = memberships.length;

  return (
    <Stack gap="sm">
      <Text size="sm" c="dimmed">
        Appears in {directCount} zone{directCount === 1 ? '' : 's'} directly
        {effectiveCount !== directCount
          ? ` · ${effectiveCount} zone${effectiveCount === 1 ? '' : 's'} including nested`
          : ''}
      </Text>

      {directMemberships.length > 0 ? (
        <Stack gap="xs">
          {directMemberships.map(({ zone }) => (
            <Group key={zone.id} justify="space-between" wrap="nowrap">
              <Text size="sm" fw={500}>
                {zone.name}
              </Text>
              <Group gap="xs" wrap="nowrap">
                <Button component={Link} to={`/library/zones/${zone.id}`} variant="subtle" size="compact-xs">
                  Open zone
                </Button>
                <Button
                  variant="light"
                  color="red"
                  size="compact-xs"
                  disabled={busy}
                  onClick={() => void handleRemove(zone.id)}
                >
                  Remove from zone
                </Button>
              </Group>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          Not a direct member of any zone.
        </Text>
      )}

      {nestedOnlyMemberships.length > 0 ? (
        <Stack gap="xs">
          <Text size="xs" fw={500} c="dimmed" tt="uppercase">
            Via nested zones
          </Text>
          {nestedOnlyMemberships.map(({ zone, viaNestedZoneName }) => (
            <Group key={zone.id} justify="space-between" wrap="nowrap">
              <Text size="sm">
                {zone.name}
                {viaNestedZoneName ? ` (via ${viaNestedZoneName})` : ''}
              </Text>
              <Button component={Link} to={`/library/zones/${zone.id}`} variant="subtle" size="compact-xs">
                Open zone
              </Button>
            </Group>
          ))}
        </Stack>
      ) : null}

      <Group align="flex-end" wrap="wrap">
        <ZoneSelect
          label="Add to zone"
          zones={zonesAvailableToAdd}
          value={selectedZoneId}
          onChange={setSelectedZoneId}
        />
        <Button disabled={!selectedZoneId || busy} loading={busy} onClick={() => void handleAdd()}>
          Add
        </Button>
      </Group>

      {error ? <Alert color="red">{error}</Alert> : null}
    </Stack>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { Alert, Group, Stack, Text } from '@mantine/core';
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
import { Pill } from '../v2/index.ts';
import ZoneSelect from './ZoneSelect.tsx';
import classes from './ChannelZoneMembershipSection.module.css';

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

  return (
    <Stack gap="md">
      <p className={classes.hint}>
        Zones containing this channel. To reorder or manage other members, edit the zone itself.
      </p>

      {directMemberships.length === 0 && nestedOnlyMemberships.length === 0 ? (
        <p className={classes.hint}>Not in a zone yet.</p>
      ) : null}

      <div className={classes.chipRow}>
        {directMemberships.map(({ zone }) => (
          <Pill key={zone.id} tone="neutral" onRemove={() => void handleRemove(zone.id)}>
            {zone.name}
          </Pill>
        ))}
        <div className={classes.addZone}>
          <ZoneSelect
            label={directMemberships.length > 0 ? undefined : 'Add to zone'}
            placeholder="Add to zone…"
            zones={zonesAvailableToAdd}
            value={selectedZoneId}
            onChange={setSelectedZoneId}
          />
        </div>
        {selectedZoneId ? (
          <button
            type="button"
            className={classes.addButton}
            disabled={busy}
            onClick={() => void handleAdd()}
          >
            Add
          </button>
        ) : null}
      </div>

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
              <Link to={`/library/zones/${zone.id}`} className={classes.openLink}>
                Open zone
              </Link>
            </Group>
          ))}
        </Stack>
      ) : null}

      {error ? <Alert color="red">{error}</Alert> : null}
    </Stack>
  );
}

import {
  Button,
  Group,
  Modal,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Channel, Library, Zone } from '@core/models/library.ts';
import { addChannelsToZoneMembers, addZonesToZoneMembers } from '@core/domain/zoneMembership.ts';
import { directZoneMemberChannelIds } from '@core/domain/zoneMembers.ts';
import { zoneIdsExcludedFromMembership } from '@core/domain/zoneHierarchy.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import { DataTable } from '../ui/index.ts';
import { useChannelListQuery } from '../../hooks/useChannelListQuery.ts';
import { useFilteredChannels } from '../../hooks/useChannelListFilters.ts';
import {
  useLibraryChannelColumns,
  useLibraryChannelSortCtx,
} from '../../hooks/useLibraryChannelColumns.tsx';
import { sortDataTableRows } from '../../lib/dataTable/sort.ts';
import { DATATABLE_NAME_SORT_KEY } from '../../lib/dataTable/sort.ts';
import { useOperatorPosition } from '../../state/operatorPosition.tsx';
import { persistence } from '../../state/persistence.ts';
import { sortByName } from '../../lib/channels.ts';
import ZoneSelect from './ZoneSelect.tsx';

type MembershipFilter = 'any' | 'in-zone' | 'not-in-zone';

export interface AddChannelsToZoneModalProps {
  opened: boolean;
  onClose: () => void;
  library: Library;
  /** When null (orphans pivot), operator picks a target zone inside the modal. */
  targetZone: Zone | null;
  onAdded?: () => void;
}

export default function AddChannelsToZoneModal({
  opened,
  onClose,
  library,
  targetZone,
  onAdded,
}: AddChannelsToZoneModalProps) {
  const query = useChannelListQuery();
  const { position } = useOperatorPosition();
  const optionalColumnDefs = useLibraryChannelColumns(library, position);
  const sortCtx = useLibraryChannelSortCtx(optionalColumnDefs);
  const [pickedZoneId, setPickedZoneId] = useState<string | null>(targetZone?.id ?? null);
  const [membershipFilter, setMembershipFilter] = useState<MembershipFilter>('not-in-zone');
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [zoneSearch, setZoneSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveZone = useMemo(() => {
    const id = targetZone?.id ?? pickedZoneId;
    if (!id) return null;
    return library.zones.find((zone) => zone.id === id) ?? null;
  }, [library.zones, pickedZoneId, targetZone?.id]);

  const directMemberChannelIds = useMemo(
    () => new Set(effectiveZone ? directZoneMemberChannelIds(effectiveZone) : []),
    [effectiveZone],
  );

  const membershipFilteredChannels = useMemo(() => {
    return library.channels.filter((channel) => {
      const inZone = directMemberChannelIds.has(channel.id);
      if (membershipFilter === 'in-zone') return inZone;
      if (membershipFilter === 'not-in-zone') return !inZone;
      return true;
    });
  }, [directMemberChannelIds, library.channels, membershipFilter]);

  const filteredChannels = useFilteredChannels(membershipFilteredChannels, query, position);
  const sortedChannels = useMemo(
    () =>
      sortDataTableRows(
        filteredChannels,
        { columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' },
        sortCtx,
      ),
    [filteredChannels, sortCtx],
  );

  const excludedZoneIds = useMemo(() => {
    if (!effectiveZone) return new Set<string>();
    return zoneIdsExcludedFromMembership(effectiveZone.id, library.zones);
  }, [effectiveZone, library.zones]);

  const availableNestedZones = useMemo(() => {
    const filterLower = zoneSearch.trim().toLowerCase();
    return sortByName(library.zones).filter((zone) => {
      if (excludedZoneIds.has(zone.id)) return false;
      if (!filterLower) return true;
      return zone.name.toLowerCase().includes(filterLower);
    });
  }, [excludedZoneIds, library.zones, zoneSearch]);

  const resetState = useCallback(() => {
    setSelectedChannelIds([]);
    setSelectedZoneIds([]);
    setError(null);
    if (!targetZone) setPickedZoneId(null);
  }, [targetZone]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const persistMembers = useCallback(
    async (nextMembers: Zone['members']) => {
      if (!effectiveZone) return;
      setSaving(true);
      setError(null);
      try {
        validateZoneMembership(effectiveZone.id, nextMembers, {
          ...library,
          zones: library.zones.map((zone) =>
            zone.id === effectiveZone.id ? { ...zone, members: nextMembers } : zone,
          ),
        });
        const result = await persistence.putZone(
          { ...effectiveZone, members: nextMembers },
          effectiveZone.revision,
        );
        if (!result.ok) {
          setError(`Failed to save zone (${result.reason})`);
          return;
        }
        onAdded?.();
        handleClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save zone');
      } finally {
        setSaving(false);
      }
    },
    [effectiveZone, handleClose, library, onAdded],
  );

  const handleAddChannels = useCallback(() => {
    if (!effectiveZone || selectedChannelIds.length === 0) return;
    const next = addChannelsToZoneMembers(effectiveZone.members, selectedChannelIds);
    void persistMembers(next);
  }, [effectiveZone, persistMembers, selectedChannelIds]);

  const handleAddNestedZones = useCallback(() => {
    if (!effectiveZone || selectedZoneIds.length === 0) return;
    const next = addZonesToZoneMembers(effectiveZone.members, selectedZoneIds);
    void persistMembers(next);
  }, [effectiveZone, persistMembers, selectedZoneIds]);

  return (
    <Modal opened={opened} onClose={handleClose} title="Add to zone" size="xl" centered>
      <Stack gap="md">
        {!targetZone ? (
          <ZoneSelect
            label="Target zone"
            zones={library.zones}
            value={pickedZoneId}
            onChange={setPickedZoneId}
          />
        ) : null}

        <Group gap="xs">
          <Button component={Link} to="/library/channels/new" variant="light" size="compact-sm">
            New channel
          </Button>
          <Button
            component={Link}
            to="/library/channels/add-channel-set"
            variant="light"
            size="compact-sm"
          >
            Add channel set…
          </Button>
          <Button
            component={Link}
            to="/library/channels/add-from-ukrepeater"
            variant="light"
            size="compact-sm"
          >
            ukrepeater.net
          </Button>
          <Button
            component={Link}
            to="/library/channels/add-from-brandmeister"
            variant="light"
            size="compact-sm"
          >
            BrandMeister
          </Button>
        </Group>

        <Tabs defaultValue="channels">
          <Tabs.List>
            <Tabs.Tab value="channels">Channels</Tabs.Tab>
            <Tabs.Tab value="zones">Nested zones</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="channels" pt="md">
            <Stack gap="sm">
              <SegmentedControl
                value={membershipFilter}
                onChange={(value) => setMembershipFilter(value as MembershipFilter)}
                data={[
                  { value: 'any', label: 'Any' },
                  { value: 'not-in-zone', label: 'Not in zone' },
                  { value: 'in-zone', label: 'In zone' },
                ]}
              />
              <DataTable
                variant="list"
                rows={sortedChannels}
                totalRowCount={membershipFilteredChannels.length}
                rowKey={(ch: Channel) => ch.id}
                sort={{ columnKey: DATATABLE_NAME_SORT_KEY, direction: 'asc' }}
                callsignColumn={sortCtx.callsignColumn}
                nameColumn={sortCtx.nameColumn}
                columns={optionalColumnDefs}
                search={query.nameFilterInput}
                searchPending={query.nameFilterPending}
                onSearchChange={query.setNameFilter}
                searchPlaceholder="Filter name or callsign…"
                selectable
                selectedKeys={selectedChannelIds}
                onSelectedKeysChange={setSelectedChannelIds}
              />
              <Group justify="flex-end">
                <Button
                  disabled={!effectiveZone || selectedChannelIds.length === 0}
                  loading={saving}
                  onClick={handleAddChannels}
                >
                  Add {selectedChannelIds.length} channel
                  {selectedChannelIds.length === 1 ? '' : 's'}
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="zones" pt="md">
            <Stack gap="sm">
              <TextInput
                label="Filter zones"
                placeholder="Filter name…"
                value={zoneSearch}
                onChange={(event) => setZoneSearch(event.currentTarget.value)}
              />
              <DataTable
                variant="list"
                rows={availableNestedZones}
                totalRowCount={availableNestedZones.length}
                rowKey={(zone) => zone.id}
                nameColumn={{
                  getName: (zone) => zone.name,
                  getPath: () => '#',
                }}
                columns={[]}
                selectable
                selectedKeys={selectedZoneIds}
                onSelectedKeysChange={setSelectedZoneIds}
              />
              <Group justify="flex-end">
                <Button
                  disabled={!effectiveZone || selectedZoneIds.length === 0}
                  loading={saving}
                  onClick={handleAddNestedZones}
                >
                  Add {selectedZoneIds.length} nested zone
                  {selectedZoneIds.length === 1 ? '' : 's'}
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        {error ? (
          <Text size="sm" c="red">
            {error}
          </Text>
        ) : null}
      </Stack>
    </Modal>
  );
}

import { ActionIcon, Badge, Checkbox, Group, SegmentedControl, Stack, Text, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import type {
  DigitalContact,
  EntityRef,
  Library,
  RxGroupListMember,
  TalkGroup,
} from '@core/models/library.ts';
import {
  reorderRxGroupListMembers,
  rxGroupListMemberKey,
} from '@core/domain/membershipOrder.ts';
import { sortRxGroupListMembersByMode } from '@core/domain/membershipSort.ts';
import { sortByName } from '../../lib/channels.ts';
import { ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  applyTimeslotSegment,
  memberOptionMatchesFilter,
  memberSupportsTimeSlotOverride,
  timeslotSegmentValue,
} from '../../lib/rxGroupListMembers.ts';
import AvailableItemPicker from '../ui/AvailableItemPicker.tsx';
import SelectedItemDragHandle from '../ui/SelectedItemDragHandle.tsx';
import SelectedItemList from '../ui/SelectedItemList.tsx';
import { PageSection } from '../ui/index.ts';
import MembershipSortMenu from './MembershipSortMenu.tsx';

export interface RxGroupListMemberPickerProps {
  talkGroups: TalkGroup[];
  digitalContacts: DigitalContact[];
  library: Library;
  members: RxGroupListMember[];
  onChange: (members: RxGroupListMember[]) => void;
}

interface MemberOption {
  ref: EntityRef;
  name: string;
  digitalId: number;
  key: string;
}

const TIMESLOT_SEGMENTS = [
  { value: 'auto', label: 'Auto' },
  { value: '1', label: 'TS1' },
  { value: '2', label: 'TS2' },
] as const;

function buildTalkGroupOptions(talkGroups: TalkGroup[]): MemberOption[] {
  return sortByName(talkGroups).map((t) => ({
    ref: { kind: 'talkGroup' as const, id: t.id },
    name: t.name,
    digitalId: t.digitalId,
    key: rxGroupListMemberKey({ ref: { kind: 'talkGroup', id: t.id } }),
  }));
}

function buildDigitalContactOptions(digitalContacts: DigitalContact[]): MemberOption[] {
  return sortByName(digitalContacts).map((c) => ({
    ref: { kind: 'digitalContact' as const, id: c.id },
    name: c.name,
    digitalId: c.digitalId,
    key: rxGroupListMemberKey({ ref: { kind: 'digitalContact', id: c.id } }),
  }));
}

/** Remap ordered keys → members so timeSlotOverride survives drag reorder. */
export function reorderRxGroupListMembersByKeys(
  members: RxGroupListMember[],
  orderedKeys: string[],
): RxGroupListMember[] {
  if (orderedKeys.length !== members.length) return members;
  const byKey = new Map(members.map((member) => [rxGroupListMemberKey(member), member]));
  const next = orderedKeys.map((key) => byKey.get(key));
  if (next.some((row) => row == null)) return members;
  return next as RxGroupListMember[];
}

function MemberKindBadge({ kind }: { kind: EntityRef['kind'] }) {
  if (kind === 'talkGroup') {
    return <Badge size="sm">Talk group</Badge>;
  }
  return (
    <Badge size="sm" color="grape">
      Digital contact
    </Badge>
  );
}

export default function RxGroupListMemberPicker({
  talkGroups,
  digitalContacts,
  library,
  members,
  onChange,
}: RxGroupListMemberPickerProps) {
  const [inListFilter, setInListFilter] = useState('');
  const [availableFilter, setAvailableFilter] = useState('');
  const [inListSelected, setInListSelected] = useState<string[]>([]);
  const [availableTgSelected, setAvailableTgSelected] = useState<string[]>([]);
  const [availableDcSelected, setAvailableDcSelected] = useState<string[]>([]);

  const talkGroupsById = useMemo(
    () => new Map(talkGroups.map((row) => [row.id, row])),
    [talkGroups],
  );
  const digitalContactsById = useMemo(
    () => new Map(digitalContacts.map((row) => [row.id, row])),
    [digitalContacts],
  );

  const selectedRefKeys = useMemo(
    () => new Set(members.map((member) => rxGroupListMemberKey(member))),
    [members],
  );

  const allOptions = useMemo(
    () => [...buildTalkGroupOptions(talkGroups), ...buildDigitalContactOptions(digitalContacts)],
    [talkGroups, digitalContacts],
  );

  const optionByKey = useMemo(() => new Map(allOptions.map((o) => [o.key, o])), [allOptions]);

  const memberKeys = useMemo(() => members.map(rxGroupListMemberKey), [members]);

  const inListFilterLower = inListFilter.trim().toLowerCase();
  const availableFilterLower = availableFilter.trim().toLowerCase();
  const filterActive = inListFilterLower.length > 0;

  const filteredInListKeys = useMemo(() => {
    if (!filterActive) return memberKeys;
    return memberKeys.filter((key) => {
      const option = optionByKey.get(key);
      if (!option) return true;
      return memberOptionMatchesFilter(option.name, option.digitalId, inListFilterLower);
    });
  }, [filterActive, memberKeys, optionByKey, inListFilterLower]);

  const availableTalkGroups = useMemo(
    () =>
      buildTalkGroupOptions(talkGroups).filter(
        (o) =>
          !selectedRefKeys.has(o.key) &&
          memberOptionMatchesFilter(o.name, o.digitalId, availableFilterLower),
      ),
    [talkGroups, selectedRefKeys, availableFilterLower],
  );

  const availableDigitalContacts = useMemo(
    () =>
      buildDigitalContactOptions(digitalContacts).filter(
        (o) =>
          !selectedRefKeys.has(o.key) &&
          memberOptionMatchesFilter(o.name, o.digitalId, availableFilterLower),
      ),
    [digitalContacts, selectedRefKeys, availableFilterLower],
  );

  const toggleInList = useCallback((key: string) => {
    setInListSelected((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
    );
  }, []);

  const removeKeys = useCallback(
    (keys: string[]) => {
      if (!keys.length) return;
      const remove = new Set(keys);
      onChange(members.filter((member) => !remove.has(rxGroupListMemberKey(member))));
      setInListSelected((prev) => prev.filter((key) => !remove.has(key)));
    },
    [members, onChange],
  );

  const moveSelected = useCallback(
    (direction: 'up' | 'down') => {
      if (!inListSelected.length || filterActive) return;
      onChange(reorderRxGroupListMembers(members, new Set(inListSelected), direction));
    },
    [filterActive, inListSelected, members, onChange],
  );

  const addSelected = useCallback(() => {
    const toAdd = [...availableTgSelected, ...availableDcSelected]
      .map((key) => optionByKey.get(key)?.ref)
      .filter(
        (ref): ref is EntityRef =>
          ref != null && !selectedRefKeys.has(rxGroupListMemberKey({ ref })),
      )
      .map((ref) => ({ ref }));
    if (!toAdd.length) return;
    onChange([...members, ...toAdd]);
    setAvailableTgSelected([]);
    setAvailableDcSelected([]);
  }, [
    availableDcSelected,
    availableTgSelected,
    members,
    onChange,
    optionByKey,
    selectedRefKeys,
  ]);

  const setMemberTimeslot = useCallback(
    (refKey: string, value: string) => {
      onChange(
        members.map((member) => {
          if (rxGroupListMemberKey(member) !== refKey) return member;
          return applyTimeslotSegment(member, value);
        }),
      );
    },
    [members, onChange],
  );

  const canMoveUp =
    !filterActive &&
    inListSelected.some((key) => {
      const index = memberKeys.indexOf(key);
      return index > 0;
    });
  const canMoveDown =
    !filterActive &&
    inListSelected.some((key) => {
      const index = memberKeys.indexOf(key);
      return index >= 0 && index < memberKeys.length - 1;
    });

  return (
    <Stack gap="lg">
      <PageSection>
        <SelectedItemList
          title="In this list"
          description={`${members.length} member${members.length === 1 ? '' : 's'} — export order. Timeslot override applies to this list membership only; Auto lets the channel slot or export rules decide.`}
          filter={{
            value: inListFilter,
            onChange: setInListFilter,
            placeholder: 'Filter by name or DMR ID…',
            'aria-label': 'Filter in-list members',
          }}
          itemKeys={filteredInListKeys}
          selectedKeys={inListSelected}
          onToggleSelect={toggleInList}
          onRemove={(key) => removeKeys([key])}
          emptyMessage="No members in list"
          onReorder={(nextKeys) => {
            if (filterActive) return;
            onChange(reorderRxGroupListMembersByKeys(members, nextKeys));
          }}
          reorderDisabled={filterActive}
          onMoveSelected={moveSelected}
          onRemoveSelected={() => removeKeys(inListSelected)}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          reorderHint={
            <Text size="xs" c="dimmed">
              {filterActive
                ? 'Clear filter to drag-reorder'
                : 'Drag handles reorder · Alt+↑/↓ moves selection'}
            </Text>
          }
          toolbar={
            <MembershipSortMenu
              modes={['name', 'callsign']}
              disabled={!members.length || filterActive}
              label="Sort members…"
              onSort={(mode) =>
                onChange(
                  sortRxGroupListMembersByMode(members, talkGroupsById, digitalContactsById, mode),
                )
              }
            />
          }
          renderItem={({ itemKey, selected, onToggleSelect, onRemove, dragHandle }) => {
            const member = members.find((row) => rxGroupListMemberKey(row) === itemKey);
            const option = optionByKey.get(itemKey);
            if (!member || !option) {
              return (
                <Group key={itemKey} gap="xs" wrap="nowrap">
                  <Text size="sm" c="dimmed">
                    {itemKey}
                  </Text>
                </Group>
              );
            }
            const showSlot = memberSupportsTimeSlotOverride(member, library);
            return (
              <Group key={itemKey} gap="xs" wrap="nowrap" align="flex-start">
                <Checkbox checked={selected} onChange={onToggleSelect} aria-label="Select" mt={4} />
                <SelectedItemDragHandle dragHandle={dragHandle} />
                <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs" wrap="nowrap" justify="space-between">
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" truncate>
                        {option.name}
                      </Text>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {option.digitalId || '—'}
                      </Text>
                    </Stack>
                    <MemberKindBadge kind={option.ref.kind} />
                  </Group>
                  {showSlot ? (
                    <SegmentedControl
                      size="xs"
                      data={[...TIMESLOT_SEGMENTS]}
                      value={timeslotSegmentValue(member)}
                      onChange={(value) => setMemberTimeslot(itemKey, value)}
                    />
                  ) : null}
                </Stack>
                <Tooltip label="Remove">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    size="sm"
                    onClick={onRemove}
                    aria-label="Remove"
                  >
                    <IconTrash size={14} stroke={ICON_STROKE} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            );
          }}
        />
      </PageSection>

      <PageSection>
        <AvailableItemPicker
          title="Other talk groups & contacts"
          description="Stage items to add to this receive group list"
          filter={{
            value: availableFilter,
            onChange: setAvailableFilter,
            placeholder: 'Filter by name or DMR ID…',
            'aria-label': 'Filter available talk groups and contacts',
          }}
          sections={[
            {
              id: 'talkGroups',
              title: 'Talk groups',
              itemKeys: availableTalkGroups.map((o) => o.key),
              selectedKeys: availableTgSelected,
              onToggleSelect: (key) =>
                setAvailableTgSelected((prev) =>
                  prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
                ),
              emptyMessage: 'No talk groups available',
              renderItem: ({ itemKey, checked, onToggle }) => {
                const option = optionByKey.get(itemKey);
                if (!option) return null;
                return (
                  <Group key={itemKey} gap="xs" wrap="nowrap" align="flex-start">
                    <Checkbox
                      checked={checked}
                      onChange={onToggle}
                      aria-label={`Select ${option.name}`}
                      mt={4}
                    />
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" truncate>
                        {option.name}
                      </Text>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {option.digitalId || '—'}
                      </Text>
                    </Stack>
                    <MemberKindBadge kind={option.ref.kind} />
                  </Group>
                );
              },
            },
            {
              id: 'digitalContacts',
              title: 'Digital contacts',
              itemKeys: availableDigitalContacts.map((o) => o.key),
              selectedKeys: availableDcSelected,
              onToggleSelect: (key) =>
                setAvailableDcSelected((prev) =>
                  prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key],
                ),
              emptyMessage: 'No digital contacts available',
              renderItem: ({ itemKey, checked, onToggle }) => {
                const option = optionByKey.get(itemKey);
                if (!option) return null;
                return (
                  <Group key={itemKey} gap="xs" wrap="nowrap" align="flex-start">
                    <Checkbox
                      checked={checked}
                      onChange={onToggle}
                      aria-label={`Select ${option.name}`}
                      mt={4}
                    />
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <Text size="sm" truncate>
                        {option.name}
                      </Text>
                      <Text size="xs" c="dimmed" ff="monospace">
                        {option.digitalId || '—'}
                      </Text>
                    </Stack>
                    <MemberKindBadge kind={option.ref.kind} />
                  </Group>
                );
              },
            },
          ]}
          onAddSelected={addSelected}
          addDisabled={!availableTgSelected.length && !availableDcSelected.length}
        />
      </PageSection>
    </Stack>
  );
}
